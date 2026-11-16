import os
import base64
import mimetypes

MSG_ERROR_UNEXPECTED = "backend.error.unexpected"

class MarkdownViewerManager:
    def __init__(self, api_ref):
        self.api = api_ref
        self.current_root = None
        self.current_roots = []

    def select_directory(self) -> dict:
        """ Buka OS Folder Picker. """
        try:
            import webview
            if not webview.windows:
                return {"status": "error", "message": "backend.md.no_window"}
            
            result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if result and len(result) > 0:
                return {"status": "success", "data": result[0]}
            return {"status": "success", "data": None}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}

    def register_workspace_roots(self, roots: list) -> dict:
        """ Mendaftarkan daftar folder root aktif untuk multi-folder workspace """
        try:
            if not isinstance(roots, list):
                return {"status": "error", "message": "backend.error.invalid_input"}
            valid_roots = []
            for r in roots:
                if isinstance(r, str) and os.path.isdir(r):
                    real_r = os.path.realpath(r)
                    if real_r not in valid_roots:
                        valid_roots.append(real_r)
            self.current_roots = valid_roots
            self.current_root = valid_roots[0] if valid_roots else None
            return {"status": "success", "data": self.current_roots}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}

    def _is_safe_path(self, target_path: str) -> bool:
        """ Memvalidasi bahwa path target aman dan berada di dalam salah satu direktori root aktif jika diset """
        if not target_path or not isinstance(target_path, str):
            return False
        if self.current_roots:
            active_roots = self.current_roots
        elif self.current_root:
            active_roots = [self.current_root]
        else:
            active_roots = []
        if not active_roots:
            return True
        try:
            real_target = os.path.realpath(target_path)
            for root in active_roots:
                real_root = os.path.realpath(root)
                if os.path.commonpath([real_root, real_target]) == real_root:
                    return True
            return False
        except Exception:
            return False

    def _build_tree(self, path: str):
        """ Fungsi rekursif untuk membangun tree direktori yang mengandung file .md """
        name = os.path.basename(path)
        is_dir = os.path.isdir(path)

        if not is_dir:
            return {"name": name, "path": path, "type": "file"} if name.lower().endswith('.md') else None

        # Ignored dirs
        if name.startswith('.') or name in ['node_modules', 'dist', 'build', '__pycache__', 'vendor']:
            return None

        children = []
        try:
            entries = sorted(os.listdir(path))
            for entry in entries:
                child_path = os.path.join(path, entry)
                child_node = self._build_tree(child_path)
                if child_node:
                    children.append(child_node)
        except PermissionError:
            pass
        
        # Only return directory if it has markdown files inside
        if children:
            # Sort: Directories first, then files, alphabetically
            children.sort(key=lambda x: (0 if x['type'] == 'dir' else 1, x['name'].lower()))
            return {"name": name, "path": path, "type": "dir", "children": children}
        return None

    def get_markdown_tree(self, root_path: str) -> dict:
        """ Mendapatkan struktur folder dan file markdown """
        try:
            if not root_path or not isinstance(root_path, str):
                return {"status": "error", "message": "backend.md.folder_not_found"}

            if not os.path.exists(root_path) or not os.path.isdir(root_path):
                return {"status": "error", "message": "backend.md.folder_not_found"}

            real_root = os.path.realpath(root_path)
            self.current_root = real_root
            if real_root not in self.current_roots:
                self.current_roots.append(real_root)

            tree = self._build_tree(root_path)
            if not tree:
                return {"status": "success", "data": []}
            
            return {"status": "success", "data": tree.get('children', [])}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}

    def get_multi_markdown_tree(self, root_paths: list) -> dict:
        """ Mendapatkan struktur folder dan file markdown untuk beberapa direktori sekaligus """
        try:
            if not isinstance(root_paths, list):
                return {"status": "error", "message": "backend.error.invalid_input"}

            results = []
            valid_roots = []
            for rp in root_paths:
                if not isinstance(rp, str) or not os.path.isdir(rp):
                    continue
                real_r = os.path.realpath(rp)
                if real_r not in valid_roots:
                    valid_roots.append(real_r)
                tree = self._build_tree(rp)
                children = tree.get('children', []) if tree else []
                results.append({
                    "root_path": real_r,
                    "name": os.path.basename(real_r) or real_r,
                    "children": children
                })

            self.current_roots = valid_roots
            self.current_root = valid_roots[0] if valid_roots else None
            return {"status": "success", "data": results}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}

    def read_markdown_file(self, file_path: str) -> dict:
        """ Membaca konten teks dari file .md """
        try:
            if not self._is_safe_path(file_path):
                return {"status": "error", "message": "backend.error.path_traversal"}

            if not os.path.exists(file_path):
                return {"status": "error", "message": "backend.md.file_not_found"}
            
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            
            return {"status": "success", "data": content}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}

    def get_local_media_base64(self, file_path: str) -> dict:
        """ Membaca file media (image) dan mengembalikannya sebagai base64 URI """
        try:
            if not self._is_safe_path(file_path):
                return {"status": "error", "message": "backend.error.path_traversal"}

            if not os.path.exists(file_path):
                return {"status": "error", "message": "backend.md.media_not_found"}
                
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = "application/octet-stream"
                
            with open(file_path, 'rb') as f:
                encoded = base64.b64encode(f.read()).decode('utf-8')
                
            return {"status": "success", "data": f"data:{mime_type};base64,{encoded}"}
        except Exception as e:
            return {"status": "error", "message": MSG_ERROR_UNEXPECTED, "args": {"e": str(e)}}
