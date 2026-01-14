const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Berhasil Terhubung ke MongoDB Compass (Lokal)");
  })
  .catch((err) => {
    console.error("❌ Gagal Konek ke Compass. Pastikan MongoDB Service sudah Start.");
    console.error("Detail Error:", err.message);
  });


// 2. Schema Barang
const BarangSchema = new mongoose.Schema({
    kode: String,
    namaBarang: String,
    stokAwal: Number,
    masuk: Number,
    keluar: Number,
    stokAkhir: Number,
    namaFile: String, // Tambahkan ini
    tanggalUpload: { type: Date, default: Date.now }
});
const Barang = mongoose.model('Barang', BarangSchema);

// 3. Konfigurasi Upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 4. API Endpoint untuk Upload Excel
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Tidak ada file yang diunggah" });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        
        // Cek apakah sheet yang dibutuhkan ada
        if (!workbook.Sheets['DATA']) {
            throw new Error("Sheet bernama 'DATA' tidak ditemukan di Excel!");
        }

        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets['DATA']);
        const sheetMasuk = XLSX.utils.sheet_to_json(workbook.Sheets['BARANG MASUK']) || [];
        const sheetKeluar = XLSX.utils.sheet_to_json(workbook.Sheets['BARANG KELUAR']) || [];

        const docs = sheetData.map((item, index) => {
            // Validasi: Cek apakah kolom KODE ada di baris ini
            if (!item.KODE) {
                console.warn(`Baris ${index + 1} di sheet DATA tidak punya KODE. Dilewati.`);
                return null;
            }

            const msk = sheetMasuk.find(m => m.KODE === item.KODE)?.MASUK || 0;
            const klr = sheetKeluar.find(k => k.KODE === item.KODE)?.KELUAR || 0;
            const awal = item['STOCK AWAL'] || 0;

            return {
                kode: item.KODE,
                namaBarang: item['NAMA BARANG'] || "Tanpa Nama",
                stokAwal: awal,
                masuk: msk,
                keluar: klr,
                stokAkhir: (awal + msk - klr),
                namaFile: req.file.originalname,
                tanggalUpload: new Date()
            };
        }).filter(doc => doc !== null); // Buang data yang tidak valid

        if (docs.length === 0) throw new Error("Tidak ada data valid untuk disimpan.");

        await Barang.insertMany(docs);
        res.status(200).json({ message: "Berhasil!", count: docs.length });

    } catch (error) {
        console.error("DEBUG UPLOAD:", error.message);
        res.status(500).json({ error: error.message });
    }
});// API untuk Reset Data
app.delete('/api/reset', async (req, res) => {
    try {
        // Menghapus SEMUA dokumen di collection Barang
        const result = await Barang.deleteMany({});
        console.log("Data berhasil direset:", result);
        res.status(200).json({ message: "Database berhasil dikosongkan!" });
    } catch (error) {
        console.error("Gagal Reset:", error);
        res.status(500).json({ error: "Gagal menghapus data di database" });
    }
});

// 5. API untuk Ambil Data
app.get('/api/barang', async (req, res) => {
    const data = await Barang.find();
    res.json(data);
});

app.listen(5000, () => console.log("Server running on port 5000"));