/**
 * Membatasi nilai persentase progress ke rentang [0, 100].
 * Pengaman sisi frontend: backend seharusnya selalu mengirim 0-100 lewat
 * event `vylo_progress`, tapi nilai di luar rentang (mis. akibat bug
 * kalkulasi progress di backend) tidak boleh ditampilkan mentah-mentah
 * ke UI. Lihat docs/known_bugs.md.
 */
export function clampPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(100, Math.max(0, value));
}
