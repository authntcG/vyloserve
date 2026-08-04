<div align="center">

# 🚀 VyloServe
**The Modern, High-Performance Local Web Development Environment**

[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?logo=react&style=flat-square)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF?logo=vite&style=flat-square)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Style-Tailwind_CSS-38B2AC?logo=tailwind-css&style=flat-square)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Backend-Python_3-3776AB?logo=python&style=flat-square)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Status-Active_Development-emerald?style=flat-square)]()

**VyloServe** is an enterprise-grade local web server manager designed as a faster, more beautiful, and native-feeling alternative to traditional tools like XAMPP, WAMP, or Laragon. 

[Features](#-key-features) • [Tech Stack](#%EF%B8%8F-tech-stack) • [Roadmap](#-roadmap) • [Getting Started](#-getting-started)

</div>

## 💡 What is VyloServe?

VyloServe is a meticulously crafted local server manager designed for modern web developers. Moving away from the clunky, outdated interfaces of traditional local environments, VyloServe provides a sleek, enterprise-grade Dashboard to manage your Apache Virtual Hosts, Multi-Version PHP (FastCGI), and Local Databases seamlessly.

Built on top of **PyWebView**[cite: 7], VyloServe offers a 100% native desktop application feel—complete with custom context menus, blocked browser shortcuts, and hardware-accelerated UI rendering, all powered by **React**, **Vite**, and **Tailwind CSS**[cite: 7].

## ✨ Key Features (So Far)

### 🎛️ Smart Global Dashboard

* **The Big Switch:** Start or stop all your configured services (Apache & PHP) with a single click. VyloServe intelligently orchestrates the execution order (PHP FastCGI first, then Apache) to prevent gateway crashes.
* **Zero-CPU Sparkline Monitors:** Real-time CPU and Memory usage tracking utilizing native SVG cubic-bezier sparklines. It delivers a fluid, Datadog-like monitoring experience with dynamic vertical gradients without consuming hardware resources.
* **Persistent Workspace:** Your selections, from the active Apache version to multiple running PHP versions, are saved securely in `data/dashboard.json`[cite: 7] and restored exactly as you left them.

### 🌐 Apache Web Server Automation

* **Automated Virtual Hosts:** Create, edit, and delete local `.test` or `.loc` domains instantly.
* **Instant Explorer & Browser Access:** One-click shortcuts to open your project directories or launch the browser directly from the UI.
* **Version Control:** Effortlessly switch between different Apache versions installed on your machine.

### 🐘 Advanced PHP FastCGI

* **True Multi-Version Support:** Run PHP 7.4 and PHP 8.2 simultaneously. VyloServe handles port assignment (e.g., 9000, 9001, 9002) and prevents port collision automatically.
* **Automated ProxyPass:** Binds Apache Virtual Hosts to specific PHP FastCGI ports behind the scenes.
* **One-Click Extensions:** Toggle PHP extensions directly from the UI with an integrated search bar—no more manual `php.ini` editing!

### 🖥️ "Zero-Web-Vibe" Native UX

* **App Interceptor:** Built-in global interceptors block annoying browser behaviors (e.g., F5 refresh, Ctrl+P, URL hover hints).
* **Custom Context Menus:** Right-clicking is disabled globally except on log panels, where a beautiful custom UI appears for quick log copying.

## 🏗️ Architecture & Tech Stack

VyloServe separates the heavy lifting from the presentation layer to ensure maximum performance and maintainability[cite: 7]:

* **Backend (`/core`):** Pure Python[cite: 7]. Handles OS-level operations, process management (`psutil`), binary downloads, and configuration patching (`httpd.conf`, `php.ini`).
* **Frontend (`/frontend`):** React 18 + TypeScript + Vite[cite: 7]. Styled with Tailwind CSS for a dark-mode-first, responsive, and gorgeous UI.
* **Bridge:** `pywebview` establishes a fast, bidirectional, native window bridge between Python and React.

## 🚀 Roadmap & Future Features

VyloServe is actively in development. Here is what we have built and what is coming next:

* [x] **Core Engine:** PyWebView bridging and UI scaffolding.
* [x] **Apache Module:** Virtual host generator, version management, directory linking.
* [x] **PHP Module:** FastCGI integration, extension toggling, multi-port collision detection.
* [x] **Dashboard:** Global control panel, smart suggestions, and real-time resource polling.
* [ ] **Database Module (MariaDB/MySQL):** Installation, port management, and service toggling[cite: 7].
* [ ] **SSL Manager:** Auto-generate local trusted SSL certificates for `https://` access[cite: 7].
* [ ] **Developer Utilities:** Built-in QR Code Generator, Base64 Encoder, and URL Decoder[cite: 7].
* [ ] **Node.js / NVM Integration:** Manage Node versions and local PM2/NPM processes.
* [ ] **Redis / Memcached:** In-memory data structure store management.

## 🛠️ Getting Started (Development)

Want to contribute or run VyloServe from the source?

1. **Clone the repository:**
```bash
git clone [https://github.com/yourusername/vyloserve.git](https://github.com/yourusername/vyloserve.git)
cd vyloserve

```


2. **Setup Frontend:**
```bash
cd frontend
npm install
npm run dev

```


3. **Setup Backend:**
Open a new terminal in the root directory.
```bash
pip install -r requirements.txt
python main.py

```



## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page. If you have ideas to make VyloServe better, please fork the repo and create a pull request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Built with ❤️ for Developers who love clean, fast, and beautiful local environments.*
