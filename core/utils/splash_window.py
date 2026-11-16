import os
import sys
import json
import queue
import threading
from typing import Dict, Any, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from core.utils.system_utils import get_project_root, get_resource_path
from core.utils.file_utils import read_json


def _calculate_center_geometry(screen_w: int, screen_h: int, width: int = 640, height: int = 360) -> str:
    """Menghitung string geometri Tkinter (WxH+X+Y) tepat di tengah layar."""
    x = max(0, (screen_w - width) // 2)
    y = max(0, (screen_h - height) // 2)
    return f"{width}x{height}+{x}+{y}"


def _load_locale_file(locales_dir: str, lang: str) -> Dict[str, Any]:
    json_path = os.path.join(locales_dir, lang, "translation.json")
    if os.path.exists(json_path):
        data = read_json(json_path, default_type=dict)
        return data or {}
    return {}


def _get_nested_key(data: Dict[str, Any], dot_key: str) -> Optional[str]:
    """Mencari string terjemahan dari dot-path key (misal 'ui.bootstrap.starting')."""
    parts = dot_key.split(".")
    curr = data
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None
    return curr if isinstance(curr, str) else None


def _interpolate(template: str, args: Optional[dict]) -> str:
    """Mengganti placeholder {{var}} dengan nilai argumen."""
    if not args:
        return template
    res = template
    for k, v in args.items():
        res = res.replace(f"{{{{{k}}}}}", str(v))
    return res


def _translate(key: str, args: Optional[dict], current_locale: Dict[str, Any], fallback_locale: Dict[str, Any]) -> str:
    """Menerjemahkan key dengan fallback ke English, lalu ke key itu sendiri."""
    if not key:
        return ""
    val = _get_nested_key(current_locale, key)
    if val is None:
        val = _get_nested_key(fallback_locale, key)
    if val is None:
        val = key
    return _interpolate(val, args)


def _register_font_resource(font_path: str) -> bool:
    """
    Mendaftarkan file font TTF secara privat (FR_PRIVATE) ke GDI session Windows
    agar Tkinter dapat menggunakan nama font keluarga tersebut di canvas/widget.
    """
    if sys.platform != "win32" or not os.path.exists(font_path):
        return False
    try:
        import ctypes
        FR_PRIVATE = 0x10
        ret = ctypes.windll.gdi32.AddFontResourceExW(font_path, FR_PRIVATE, 0)
        return ret > 0
    except Exception:
        return False


def _load_splash_hero_layer(hero_path: str) -> Image.Image:
    if os.path.exists(hero_path):
        return Image.open(hero_path).convert("RGBA").resize((640, 360), Image.Resampling.LANCZOS)
    return Image.new("RGBA", (640, 360), (11, 15, 25, 255))

def _create_vignette_gradient() -> Image.Image:
    grad = Image.new("RGBA", (640, 360))
    draw_grad = ImageDraw.Draw(grad)
    for x in range(640):
        if x < 240:
            alpha = 245
        elif x < 440:
            ratio = (x - 240) / 200.0
            alpha = int(245 * (1.0 - ratio))
        else:
            alpha = 0
        draw_grad.line([(x, 0), (x, 360)], fill=(11, 15, 25, alpha))
    return grad

def _load_font_safe(font_path_or_name: str, size: int) -> Optional[Any]:
    try:
        return ImageFont.truetype(font_path_or_name, size)
    except Exception:
        return None

def _load_bundled_fonts(fonts_dir: Optional[str]) -> Tuple[Optional[Any], Optional[Any]]:
    if not (fonts_dir and os.path.exists(fonts_dir)):
        return None, None
    bold = _load_font_safe(os.path.join(fonts_dir, "Inter-Bold.ttf"), 24)
    sub = _load_font_safe(os.path.join(fonts_dir, "Inter-SemiBold.ttf"), 11)
    return bold, sub

def _load_system_fallback_fonts(font_bold: Optional[Any], font_sub: Optional[Any]) -> Tuple[Any, Any]:
    system_font_names = ["segoeuib.ttf", "segoeui.ttf", "arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf"]
    for font_name in system_font_names:
        if not font_bold and "b" in font_name.lower():
            font_bold = _load_font_safe(font_name, 24)
        if not font_sub:
            font_sub = _load_font_safe(font_name, 11)
        if font_bold and font_sub:
            break
    return font_bold, font_sub

def _resolve_splash_fonts(fonts_dir: Optional[str]) -> Tuple[Any, Any]:
    font_bold, font_sub = _load_bundled_fonts(fonts_dir)
    if not font_bold or not font_sub:
        font_bold, font_sub = _load_system_fallback_fonts(font_bold, font_sub)
    return font_bold, font_sub

def _create_base_splash_image(
    hero_path: str,
    logo_path: str,
    app_version: str,
    fonts_dir: Optional[str] = None
) -> Image.Image:
    """
    Menghasilkan gambar dasar (640x360) dengan memadukan asset 3D hero,
    gradient vignette gelap di sisi kiri, logo resmi 3-layer, dan tipografi Inter.
    """
    base_img = _load_splash_hero_layer(hero_path)
    grad = _create_vignette_gradient()
    comp = Image.alpha_composite(base_img, grad)

    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
        comp.paste(logo, (36, 36), logo)

    font_bold, font_sub = _resolve_splash_fonts(fonts_dir)

    draw_comp = ImageDraw.Draw(comp)
    draw_comp.text((88, 36), "VyloServe", fill=(255, 255, 255), font=font_bold)
    draw_comp.text((90, 65), f"v{app_version}", fill=(148, 163, 184), font=font_sub)
    draw_comp.rectangle([(0, 0), (639, 359)], outline=(51, 65, 85))

    return comp


class NativeSplashBootstrapper:
    """
    Jendela Splash Screen Mandiri OS-Level (Frameless, 640x360 px) tepat di tengah layar monitor OS.
    Berjalan sebelum Jendela Utama (1200x800) dibuat dan sebelum UI React di-trigger.
    """

    def __init__(self, api, app_version: str = "0.0.8-alpha"):
        self.api = api
        self.app_version = app_version
        self.root_dir = get_project_root()
        bundled_locales = get_resource_path(os.path.join("frontend", "src", "locales"))
        if os.path.exists(bundled_locales):
            self.locales_dir = bundled_locales
        else:
            self.locales_dir = os.path.join(self.root_dir, "frontend", "src", "locales")

        # Muat bahasa pengguna
        settings_path = os.path.join(self.root_dir, "data", "settings.json")
        saved_lang = "en"
        if os.path.exists(settings_path):
            try:
                s_data = read_json(settings_path, default_type=dict)
                saved_lang = s_data.get("language", "en")
            except Exception:
                saved_lang = "en"

        self.lang = saved_lang
        self.current_locale = _load_locale_file(self.locales_dir, saved_lang)
        self.fallback_locale = _load_locale_file(self.locales_dir, "en")

        self.hero_path = get_resource_path(os.path.join("frontend", "src", "assets", "splash-hero.png"))
        self.logo_path = get_resource_path(os.path.join("frontend", "src", "assets", "icons-nobg.png"))
        self.fonts_dir = get_resource_path(os.path.join("frontend", "src", "assets", "fonts"))

        self.queue: queue.Queue = queue.Queue()
        self.health_report: Optional[Dict[str, Any]] = None
        self._is_completed = False
        self._target_percent = 5
        self._current_percent = 5
        self._is_recovering = False
        self._root = None
        self._canvas = None
        self._tk_img = None

    def _t(self, key: str, args: Optional[dict] = None) -> str:
        return _translate(key, args, self.current_locale, self.fallback_locale)

    def _on_bootstrap_status(self, percent: int, stage_key: str, args: Optional[dict] = None, is_recovering: bool = False):
        """Callback thread-safe dari health manager Python."""
        self.queue.put({
            "type": "status",
            "percent": percent,
            "stage": stage_key,
            "args": args or {},
            "is_recovering": is_recovering
        })

    def run(self) -> Dict[str, Any]:
        """
        Menjalankan GUI Native Splash di thread utama, mengeksekusi health check di worker thread,
        dan mengembalikan health report.
        """
        import tkinter as tk
        from PIL import ImageTk

        try:
            self._root = tk.Tk()
        except Exception as e:
            print(f"[INFO] Gagal menginisialisasi Tkinter GUI ({e}). Fallback ke health check langsung...")
            return self.api.run_startup_health_check()

        try:
            # Konfigurasi Window Frameless di Tengah Monitor Utama
            self._root.overrideredirect(True)
            self._root.title("VyloServe Bootstrapper")

            screen_w = self._root.winfo_screenwidth()
            screen_h = self._root.winfo_screenheight()
            geom = _calculate_center_geometry(screen_w, screen_h, 640, 360)
            self._root.geometry(geom)

            # Usahakan selalu di depan saat fase bootstrapper
            try:
                self._root.attributes("-topmost", True)
            except Exception:
                pass

            # Register Inter custom fonts into Windows GDI session
            if os.path.exists(self.fonts_dir):
                _register_font_resource(os.path.join(self.fonts_dir, "Inter-Regular.ttf"))
                _register_font_resource(os.path.join(self.fonts_dir, "Inter-SemiBold.ttf"))
                _register_font_resource(os.path.join(self.fonts_dir, "Inter-Bold.ttf"))

            font_family = "Segoe UI"
            try:
                import tkinter.font as tkfont
                available_families = [f.lower() for f in tkfont.families(self._root)]
                if "inter" in available_families:
                    font_family = "Inter"
            except Exception:
                font_family = "Segoe UI"

            # Siapkan Base Composite Image
            base_img = _create_base_splash_image(
                hero_path=self.hero_path,
                logo_path=self.logo_path,
                app_version=self.app_version,
                fonts_dir=self.fonts_dir
            )
            self._tk_img = ImageTk.PhotoImage(base_img)

            # Buat Canvas
            self._canvas = tk.Canvas(
                self._root,
                width=640,
                height=360,
                bd=0,
                highlightthickness=0,
                bg="#0b0f19"
            )
            self._canvas.pack(fill="both", expand=True)
            self._canvas.create_image(0, 0, image=self._tk_img, anchor="nw")

            # Elemen Dinamis di Atas Canvas
            # 1. Status Indicator Dot
            self.dot_id = self._canvas.create_oval(36, 318, 44, 326, fill="#3b82f6", outline="")

            # 2. Status Stage Text (Inter Regular)
            initial_text = self._t("ui.bootstrap.starting")
            self.text_id = self._canvas.create_text(
                54,
                322,
                text=initial_text,
                fill="#cbd5e1",
                anchor="w",
                font=(font_family, 10)
            )

            # 3. Recovery Badge (Tersembunyi secara default, pill di kanan atas)
            self.recovery_box_id = self._canvas.create_rectangle(
                520, 36, 604, 56,
                fill="#451a03",
                outline="#f59e0b",
                width=1,
                state="hidden"
            )
            self.recovery_text_id = self._canvas.create_text(
                562, 46,
                text=self._t("ui.bootstrap.recovery_badge").upper(),
                fill="#fbbf24",
                font=(font_family, 8, "bold"),
                state="hidden"
            )

            # 4. Progress Bar Pinned at Bottom
            self.pb_track_id = self._canvas.create_rectangle(0, 356, 640, 360, fill="#1e293b", outline="")
            self.pb_fill_id = self._canvas.create_rectangle(0, 356, 32, 360, fill="#06b6d4", outline="")

            # Hubungkan listener status bootstrap di Api
            self.api.set_bootstrap_listener(self._on_bootstrap_status)

            # Jalankan Health Check di Background Worker Thread
            def worker():
                try:
                    report = self.api.run_startup_health_check()
                    self.queue.put({"type": "done", "report": report})
                except Exception as ex:
                    print(f"[ERROR] Health check gagal di worker thread: {ex}")
                    self.queue.put({
                        "type": "done",
                        "report": {"status": "error", "message": str(ex), "recovered": [], "purged": [], "deferred_offline": []}
                    })

            thread = threading.Thread(target=worker, daemon=True)
            thread.start()

            # Poll Queue loop di Tkinter
            self._root.after(16, self._poll_queue)

            # Mulai Tkinter Event Loop
            self._root.mainloop()

        except Exception as e:
            print(f"[WARNING] Terjadi kesalahan pada Native Splash: {e}. Menjalankan health check langsung...")
            if not self.health_report:
                self.health_report = self.api.run_startup_health_check()
        finally:
            self.api.set_bootstrap_listener(None)

        return self.health_report or {"status": "success", "recovered": [], "purged": [], "deferred_offline": []}

    def _poll_queue(self):
        """Memproses pesan dari background thread di thread UI Tkinter."""
        while not self.queue.empty():
            msg = self.queue.get_nowait()
            msg_type = msg.get("type")

            if msg_type == "status":
                pct = msg.get("percent", self._target_percent)
                self._target_percent = max(self._target_percent, pct)
                stage_key = msg.get("stage", "")
                args = msg.get("args", {})
                self._is_recovering = msg.get("is_recovering", False)

                # Update status text
                if stage_key:
                    stage_text = self._t(stage_key, args)
                    self._canvas.itemconfig(self.text_id, text=stage_text)

                # Update recovery badge, dot, text & pb color
                if self._is_recovering:
                    self._canvas.itemconfig(self.recovery_box_id, state="normal")
                    self._canvas.itemconfig(self.recovery_text_id, state="normal")
                    self._canvas.itemconfig(self.dot_id, fill="#f59e0b")
                    self._canvas.itemconfig(self.text_id, fill="#fbbf24")
                    self._canvas.itemconfig(self.pb_fill_id, fill="#f59e0b")
                else:
                    self._canvas.itemconfig(self.recovery_box_id, state="hidden")
                    self._canvas.itemconfig(self.recovery_text_id, state="hidden")
                    self._canvas.itemconfig(self.dot_id, fill="#3b82f6")
                    self._canvas.itemconfig(self.text_id, fill="#cbd5e1")
                    self._canvas.itemconfig(self.pb_fill_id, fill="#06b6d4")

            elif msg_type == "done":
                self.health_report = msg.get("report")
                self._target_percent = 100
                ready_text = self._t("ui.bootstrap.ready")
                self._canvas.itemconfig(self.text_id, text=ready_text, fill="#cbd5e1")
                self._canvas.itemconfig(self.recovery_box_id, state="hidden")
                self._canvas.itemconfig(self.recovery_text_id, state="hidden")
                self._canvas.itemconfig(self.dot_id, fill="#10b981")
                self._canvas.itemconfig(self.pb_fill_id, fill="#10b981")
                self._is_completed = True

        # Animasi smooth progress bar menuju _target_percent
        if self._current_percent < self._target_percent:
            diff = self._target_percent - self._current_percent
            step = max(1.0, diff * 0.25)
            self._current_percent = min(self._target_percent, self._current_percent + step)

            # Update progress bar coords (minimalist without jumping percent text)
            fill_w = int(640 * (self._current_percent / 100.0))
            self._canvas.coords(self.pb_fill_id, 0, 356, fill_w, 360)

        if self._is_completed and self._current_percent >= 100:
            # Jeda 200ms setelah 100% lalu mulai fade-out dan keluar
            self._root.after(200, self._fade_out_and_destroy)
            return

        # Jadwalkan frame berikutnya (60 FPS)
        self._root.after(16, self._poll_queue)

    def _fade_out_and_destroy(self):
        """Animasi alpha fade-out (Windows/macOS) sebelum menutup window."""
        try:
            current_alpha = 1.0

            def step_fade():
                nonlocal current_alpha
                current_alpha -= 0.15
                if current_alpha <= 0.05:
                    try:
                        self._root.destroy()
                    except Exception:
                        pass
                else:
                    try:
                        self._root.attributes("-alpha", max(0.0, current_alpha))
                        self._root.after(16, step_fade)
                    except Exception:
                        self._root.destroy()

            step_fade()
        except Exception:
            try:
                self._root.destroy()
            except Exception:
                pass


def run_startup_bootstrapper(api, app_version: str = "0.0.8-alpha") -> Dict[str, Any]:
    """
    Entry point utama yang dipanggil oleh main.py saat aplikasi pertama kali dijalankan.
    Menampilkan splash screen native OS dan menjalankan health check sebelum jendela utama dibuat.
    """
    bootstrapper = NativeSplashBootstrapper(api, app_version=app_version)
    return bootstrapper.run()
