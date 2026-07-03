import sys
import json
import os
import traceback
import threading
from concurrent.futures import ThreadPoolExecutor

SerenaConfig = None
LanguageServerSymbolRetriever = None
headroom_compress = None

# Thread synchronization lock for stdout writes
write_lock = threading.Lock()

# Cache for project root -> (project, retriever)
serena_projects = {}

def get_serena_project(project_root):
    global SerenaConfig, LanguageServerSymbolRetriever
    if SerenaConfig is None or LanguageServerSymbolRetriever is None:
        try:
            from serena.config.serena_config import SerenaConfig
            from serena.symbol import LanguageServerSymbolRetriever
        except ImportError:
            try:
                import subprocess
                import importlib
                subprocess.check_call([sys.executable, "-m", "pip", "install", "serena-agent"], stdout=sys.stderr)
                importlib.invalidate_caches()
                from serena.config.serena_config import SerenaConfig
                from serena.symbol import LanguageServerSymbolRetriever
            except Exception as e:
                raise Exception(f"Serena package is not installed and auto-installation failed: {e}")
    
    if project_root in serena_projects:
        return serena_projects[project_root]
        
    config = SerenaConfig.from_config_file()
    project = config.get_project(project_root)
    if project is None:
        project = config.add_project_from_path(project_root)
    
    project.create_language_server_manager()
    retriever = LanguageServerSymbolRetriever(project)
    
    serena_projects[project_root] = (project, retriever)
    return project, retriever

def handle_serena(payload):
    project_root = os.path.abspath(payload["project_root"])
    file_paths = [os.path.abspath(p) for p in payload["file_paths"]]
    
    _, retriever = get_serena_project(project_root)
    
    results = {}
    for file_path in file_paths:
        rel_file_path = os.path.relpath(file_path, project_root).replace("\\", "/")
        try:
            overview = retriever.get_symbol_overview(rel_file_path)
            symbols = overview.get(rel_file_path, [])
            
            symbol_dicts = []
            for symbol in symbols:
                loc = symbol.symbol_root.get("location")
                if loc and "range" in loc:
                    start_line = loc["range"]["start"]["line"]
                    end_line = loc["range"]["end"]["line"]
                else:
                    start_line = symbol.line
                    end_line = symbol.line

                symbol_dicts.append({
                    "name": symbol.name,
                    "kind": symbol.symbol_kind_name,
                    "start_line": start_line,
                    "end_line": end_line
                })
            results[file_path] = symbol_dicts
        except Exception as e:
            results[file_path] = {"error": str(e)}
    return results

def handle_headroom(payload):
    global headroom_compress
    if headroom_compress is None:
        try:
            from headroom import compress as headroom_compress
        except ImportError:
            try:
                import subprocess
                import importlib
                subprocess.check_call([sys.executable, "-m", "pip", "install", "headroom-ai"], stdout=sys.stderr)
                importlib.invalidate_caches()
                from headroom import compress as headroom_compress
            except Exception as e:
                raise Exception(f"headroom-ai package is not installed and auto-installation failed: {e}")
    
    text = payload["text"]
    msgs = [{"role": "user", "content": text}]
    result = headroom_compress(msgs)
    if result and hasattr(result, "messages") and result.messages:
        return result.messages[0]["content"]
    return text

llmlingua_compressor = None
current_llmlingua_model = None

def handle_llmlingua(payload):
    global llmlingua_compressor, current_llmlingua_model
    text = payload["text"]
    model_name = payload.get("model_name", "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank")
    rate = payload.get("rate", 0.5)

    if llmlingua_compressor is None or current_llmlingua_model != model_name:
        try:
            from llmlingua import PromptCompressor
            use_ll2 = "llmlingua-2" in model_name.lower() or "meetingbank" in model_name.lower()
            llmlingua_compressor = PromptCompressor(model_name=model_name, use_llmlingua2=use_ll2)
            current_llmlingua_model = model_name
        except ImportError:
            try:
                import subprocess
                import importlib
                subprocess.check_call([sys.executable, "-m", "pip", "install", "llmlingua"], stdout=sys.stderr)
                importlib.invalidate_caches()
                from llmlingua import PromptCompressor
                use_ll2 = "llmlingua-2" in model_name.lower() or "meetingbank" in model_name.lower()
                llmlingua_compressor = PromptCompressor(model_name=model_name, use_llmlingua2=use_ll2)
                current_llmlingua_model = model_name
            except Exception as e:
                raise Exception(f"llmlingua package is not installed and auto-installation failed: {e}")

    try:
        if hasattr(llmlingua_compressor, "use_llmlingua2") and llmlingua_compressor.use_llmlingua2:
            result = llmlingua_compressor.compress_prompt(
                [text],
                rate=rate,
                force_tokens=["\n", "?", "!", ".", ","],
                drop_consecutive=True
            )
        else:
            result = llmlingua_compressor.compress_prompt(
                [text],
                rate=rate
            )
        return result.get("compressed_prompt", text)
    except Exception as e:
        raise Exception(f"LLMLingua compression failed: {e}")

def handle_serena_references(payload):
    project_root = os.path.abspath(payload["project_root"])
    file_path = os.path.abspath(payload["file_path"])
    target_symbols = set(payload["symbols"])
    
    _, retriever = get_serena_project(project_root)
    rel_file_path = os.path.relpath(file_path, project_root).replace("\\", "/")
    
    results = []
    try:
        overview = retriever.get_symbol_overview(rel_file_path)
        symbols = overview.get(rel_file_path, [])
        for symbol in symbols:
            if symbol.name in target_symbols:
                loc = symbol.symbol_root.get("location")
                if loc and "range" in loc:
                    from serena.symbol import LanguageServerSymbolLocation
                    sym_loc = LanguageServerSymbolLocation(
                        relative_path=rel_file_path,
                        line=loc["range"]["start"]["line"],
                        column=loc["range"]["start"]["character"]
                    )
                    refs = retriever.find_referencing_symbols_by_location(sym_loc)
                    for r in refs:
                        results.append({
                            "referenced": symbol.name,
                            "file": r.relative_path,
                            "name": r.name,
                            "line": r.line
                        })
    except Exception as e:
        return {"error": str(e)}
    return results

def handle_serena_diagnostics(payload):
    project_root = os.path.abspath(payload["project_root"])
    file_path = os.path.abspath(payload["file_path"])
    
    _, retriever = get_serena_project(project_root)
    rel_file_path = os.path.relpath(file_path, project_root).replace("\\", "/")
    
    try:
        diagnostics = retriever.get_file_diagnostics(rel_file_path)
        results = []
        for diag in diagnostics:
            results.append({
                "message": diag.message,
                "severity": diag.severity,
                "source": diag.source or "LSP",
                "code": diag.code,
                "range": {
                    "start": {
                        "line": diag.range.start.line,
                        "character": diag.range.start.character
                    },
                    "end": {
                        "line": diag.range.end.line,
                        "character": diag.range.end.character
                    }
                }
            })
        return results
    except Exception as e:
        return {"error": str(e)}

def handle_serena_search(payload):
    project_root = os.path.abspath(payload["project_root"])
    query = payload["query"].lower()
    
    _, retriever = get_serena_project(project_root)
    
    results = []
    ignored_dirs = {".git", "node_modules", "dist", "build", ".serena", "__pycache__"}
    allowed_extensions = {".ts", ".tsx", ".js", ".jsx", ".py"}
    
    try:
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file in files:
                ext = os.path.splitext(file)[1]
                if ext in allowed_extensions:
                    full_path = os.path.join(root, file)
                    rel_file_path = os.path.relpath(full_path, project_root).replace("\\", "/")
                    try:
                        overview = retriever.get_symbol_overview(rel_file_path)
                        symbols = overview.get(rel_file_path, [])
                        for sym in symbols:
                            if query in sym.name.lower():
                                loc = sym.symbol_root.get("location")
                                if loc and "range" in loc:
                                    start_line = loc["range"]["start"]["line"]
                                    end_line = loc["range"]["end"]["line"]
                                else:
                                    start_line = sym.line
                                    end_line = sym.line
                                
                                results.append({
                                    "name": sym.name,
                                    "kind": sym.symbol_kind_name,
                                    "file_path": full_path,
                                    "relative_path": rel_file_path,
                                    "start_line": start_line,
                                    "end_line": end_line
                                })
                    except:
                        continue
    except Exception as e:
        return {"error": str(e)}
    return results

def send_success(req_id, result):
    if req_id is None:
        return
    resp = {"id": req_id, "status": "success", "result": result}
    line = json.dumps(resp) + "\n"
    with write_lock:
        sys.stdout.write(line)
        sys.stdout.flush()

def send_error(req_id, error, traceback_str=None):
    if req_id is None:
        return
    resp = {"id": req_id, "status": "error", "error": error}
    if traceback_str:
        resp["traceback"] = traceback_str
    line = json.dumps(resp) + "\n"
    with write_lock:
        sys.stdout.write(line)
        sys.stdout.flush()

def process_request(req):
    req_id = req.get("id")
    action = req.get("action")
    payload = req.get("payload")
    try:
        if action == "serena":
            res = handle_serena(payload)
            send_success(req_id, res)
        elif action == "serena_references":
            res = handle_serena_references(payload)
            send_success(req_id, res)
        elif action == "serena_diagnostics":
            res = handle_serena_diagnostics(payload)
            send_success(req_id, res)
        elif action == "serena_search":
            res = handle_serena_search(payload)
            send_success(req_id, res)
        elif action == "headroom":
            res = handle_headroom(payload)
            send_success(req_id, res)
        elif action == "llmlingua":
            res = handle_llmlingua(payload)
            send_success(req_id, res)
        elif action == "status":
            projects = list(serena_projects.keys())
            res = {
                "pid": os.getpid(),
                "projects": projects,
                "platform": sys.platform,
                "python_version": sys.version
            }
            send_success(req_id, res)
        else:
            send_error(req_id, f"Unknown action: {action}")
    except Exception as e:
        tb = traceback.format_exc()
        send_error(req_id, str(e), tb)

def main():
    # Make stdout unbuffered so responses are flushed immediately
    sys.stdout.reconfigure(line_buffering=True)
    
    executor = ThreadPoolExecutor(max_workers=8)
    
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req = json.loads(line)
                action = req.get("action")
                req_id = req.get("id")
                
                if action == "shutdown":
                    executor.shutdown(wait=False)
                    for project, _ in list(serena_projects.values()):
                        try:
                            project.shutdown()
                        except:
                            pass
                    send_success(req_id, {})
                    break
                elif action in ("serena", "serena_references", "serena_diagnostics", "serena_search"):
                    # Process Serena LSP actions on the main thread to ensure proper asyncio and subprocess behavior
                    process_request(req)
                else:
                    # Offload other actions (headroom, llmlingua, status) to the thread pool
                    executor.submit(process_request, req)
            except Exception as e:
                send_error(None, f"Malformed line or submission error: {str(e)}")
    finally:
        executor.shutdown(wait=False)

if __name__ == "__main__":
    main()
