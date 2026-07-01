import sys
import json
import os
from serena.config.serena_config import SerenaConfig
from serena.symbol import LanguageServerSymbolRetriever

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}), file=sys.stderr)
        sys.exit(1)

    try:
        project_root = os.path.abspath(sys.argv[1])
        file_path = os.path.abspath(sys.argv[2])
        
        config = SerenaConfig.from_config_file()
        project = config.get_project(project_root)
        if project is None:
            project = config.add_project_from_path(project_root)
        
        # Start the language servers for the project
        project.create_language_server_manager()
        
        retriever = LanguageServerSymbolRetriever(project)
        
        # Get path relative to project root
        rel_file_path = os.path.relpath(file_path, project_root).replace("\\", "/")
        
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
            
        print(json.dumps(symbol_dicts))
        
        # Shutdown language servers
        project.shutdown()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
