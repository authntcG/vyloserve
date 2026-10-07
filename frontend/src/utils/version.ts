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
export function compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        if ((p1[i] || 0) > (p2[i] || 0)) return 1;
        if ((p1[i] || 0) < (p2[i] || 0)) return -1;
    }
    return 0;
}
