import sys
import json
import os
import traceback

SerenaConfig = None
LanguageServerSymbolRetriever = None
headroom_compress = None

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
                subprocess.check_call([sys.executable, "-m", "pip", "install", "serena-agent"])
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
                subprocess.check_call([sys.executable, "-m", "pip", "install", "headroom-ai"])
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

def main():
    # Make stdout unbuffered so responses are flushed immediately
    sys.stdout.reconfigure(line_buffering=True)
    
    for line in sys.stdin:
        if not line.strip():
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action")
            payload = req.get("payload")
            
            if action == "serena":
                res = handle_serena(payload)
                try:
                    print(json.dumps({"id": req_id, "status": "success", "result": res}))
                except:
                    pass
            elif action == "headroom":
                res = handle_headroom(payload)
                try:
                    print(json.dumps({"id": req_id, "status": "success", "result": res}))
                except:
                    pass
            elif action == "status":
                try:
                    projects = list(serena_projects.keys())
                    print(json.dumps({"id": req_id, "status": "success", "result": {
                        "pid": os.getpid(),
                        "projects": projects,
                        "platform": sys.platform,
                        "python_version": sys.version
                    }}))
                except:
                    pass
            elif action == "shutdown":
                for project, _ in serena_projects.values():
                    try:
                        project.shutdown()
                    except:
                        pass
                try:
                    print(json.dumps({"id": req_id, "status": "success"}))
                except:
                    pass
                break
            else:
                try:
                    print(json.dumps({"id": req_id, "status": "error", "error": f"Unknown action: {action}"}))
                except:
                    pass
        except Exception as e:
            tb = traceback.format_exc()
            try:
                print(json.dumps({"id": req_id, "status": "error", "error": str(e), "traceback": tb}))
            except:
                pass

if __name__ == "__main__":
    main()
