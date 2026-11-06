# Referensi UI TutupHari

TutupHari dipakai di meja warung, satu ibu jari, HP Android murah, lampu neon atau matahari. Angka uang harus kebaca tanpa menyipitkan mata. Tombol mengikuti jempol, bukan menu yang rapat.

Yang dipakai dari tiap referensi, dan yang sengaja tidak ditiru:

## 1. BukuWarung — catat transaksi yang langsung, bukan peta menu

- [Mode Kasir BukuWarung](https://www.bukuwarung.com/mengenal-mode-kasir-bukuwarung/)
- [Perbandingan tampilan BukuWarung dan BukuKas](https://www.catatandroid.com/2021/10/review-bukukas-dan-bukuwarung.html)

BukuWarung menang dari BukuKas karena beranda langsung ke transaksi, tombol besar, dan tidak menumpuk menu. TutupHari mengambil prinsip itu: satu tugas (cek laci), tanpa akun, tanpa stok.

Yang tidak ditiru: formulir penjualan dengan harga modal, status lunas, dan kategori. Pemilik warung non-POS menulis seperti chat, bukan mengisi kolom.

## 2. WhatsApp — kolom ketik di bawah, tab di jempol

- [WhatsApp: fresh, simple, approachable](https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/)
- [WhatsApp Messaging](https://www.whatsapp.com/messaging)

Pemilik warung sudah kirim pesan tiap hari. Catatan jadi gelembung di kanan, kolom tulis menempel di atas navigasi bawah. Navigasi bawah (Catat, Tutup, Riwayat) mengikuti kebiasaan jempol di Android, seperti yang dijelaskan tim desain WhatsApp saat memindahkan tab ke bawah.

## 3. Tutup laci: angka diharapkan, angka dihitung, vonis dengan kata

- [SalesThumb — cash drawer di HP](https://salesthumb.com/kb/mobile-cash-drawer)
- [oFatoura — buka dan tutup shift](https://docs.ofatoura.com/epos-app/shifts-and-cash)

Keduanya memisahkan hitung uang fisik dari vonis selisih. Vonisnya kata, bukan warna saja: pas, kurang, lebih. TutupHari menaruhnya sebagai struk: modal, arus tunai, "seharusnya di laci", lalu stempel selisih. QRIS ditulis di blok sendiri supaya tidak tercampur ke laci.

Yang tidak ditiru: wizard pecahan uang dan PIN manajer. Satu kolom total sudah cukup untuk warung tanpa kasir bergiliran.

## 4. Target sentuh dan kontras untuk kios yang silau

- [Mobile POS: zona jempol dan kontras tinggi](https://dpopstudio.co/blog/mobile-pos-ui-architecture-posify-teardown)
- [Material Design — accessible layout, target 48dp](https://m3.material.io/foundations/accessible-design/overview)

Tombol utama setinggi 48px atau lebih. Angka uang memakai angka tabular (IBM Plex Mono) supaya digit tidak meloncat saat nilainya berubah. Teks tubuh Atkinson Hyperlegible, dipilih karena hurufnya dibedakan untuk mata lelah, bukan karena terlihat "startup".

Latar hampir putih dengan sedikit hijau papan menu, bukan krem kertas dan bukan biru BukuWarung. Hijau papan hanya untuk aksi dan angka yang pas. QRIS biru dan tetap diberi kata "QRIS". Kurang berwarna merah dan tetap ditulis "Kurang".

## Yang tidak menjadi arah visual

- Dashboard metrik dengan empat kartu sama besar.
- Garis warna di pinggir kartu.
- Gradien pada teks.
- Mode gelap otomatis. Warung siang hari silau; layar terang dengan tinta gelap lebih kebaca.
