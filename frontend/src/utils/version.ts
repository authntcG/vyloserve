/**
 * Membandingkan dua version string numerik bertitik (mis. "8.2.10" vs "8.2.9") segmen
 * per segmen, BUKAN perbandingan string biasa (yang akan salah untuk kasus seperti
 * "8.2.9" > "8.2.10" secara leksikografis). Segmen yang hilang di salah satu sisi
 * dianggap 0 (mis. "8.2" vs "8.2.1" -> "8.2" diperlakukan sebagai "8.2.0").
 * Dipakai untuk deteksi "ada versi lebih baru" di php/Main.tsx dan database/Main.tsx --
 * diekstrak ke sini (bukan diduplikasi di tiap file) mengikuti pola clampPercent()
 * di progress.ts, lihat docs/ui_consistency_guide.md.
 *
 * @returns 1 kalau v1 > v2, -1 kalau v1 < v2, 0 kalau sama.
 */
export function compareVersions(v1?: string | null, v2?: string | null): number {
    const s1 = String(v1 || '').trim();
    const s2 = String(v2 || '').trim();
    if (!s1 && !s2) return 0;
    if (!s1) return -1;
    if (!s2) return 1;
    const p1 = s1.split('.').map(Number);
    const p2 = s2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = Number.isNaN(p1[i]) ? 0 : (p1[i] || 0);
        const n2 = Number.isNaN(p2[i]) ? 0 : (p2[i] || 0);
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}
