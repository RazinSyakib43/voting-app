const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid'); // Menggunakan UUID versi 4
const { Pool } = require('pg');

// Konfigurasi koneksi ke database
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'voting_db',
    password: 'yessgood123',
    port: 5432
});

const app = express();

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public folder (optional for styles, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint untuk generate QR code
app.get('/generate', async (req, res) => {
    // Generate UUID baru
    const uuid = uuidv4();

    // Data QR code dengan UUID dan vote = 0
    const qrData = {
        uuid: uuid,
        vote: 0
    };

    try {
        // Generate QR code dari data
        const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData));

        // Simpan data QR code ke database
        const query = {
            text: 'INSERT INTO votes(uuid, vote) VALUES($1, $2)',
            values: [qrData.uuid, qrData.vote]
        };
        await pool.query(query);

        // Render halaman EJS dengan QR code dan UUID
        res.render('index', {
            qrCodeUrl: qrCodeUrl,
            uuid: qrData.uuid,
            vote: qrData.vote
        });
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

// Endpoint untuk memeriksa UUID dan voting
app.get('/vote', async (req, res) => {
    const uuid = req.query.uuid;

    try {
        // Cek apakah UUID valid dan vote masih 0
        const result = await pool.query('SELECT * FROM votes WHERE uuid = $1 AND vote = 0', [uuid]);

        if (result.rows.length === 0) {
            // UUID tidak valid atau sudah pernah digunakan untuk voting
            return res.render('invalid', { message: 'QR Code tidak valid atau sudah digunakan untuk voting.' });
        }

        // UUID valid, tampilkan halaman voting
        res.render('vote', { uuid: uuid });
    } catch (err) {
        console.error('Error checking UUID for voting', err);
        res.status(500).send('Error processing voting');
    }
});

// Endpoint untuk submit voting
app.post('/vote', async (req, res) => {
    const uuid = req.body.uuid;
    const vote = parseInt(req.body.vote, 10); // Ambil nilai voting (1 atau 2)

    if (![1, 2].includes(vote)) {
        return res.status(400).send('Invalid vote value');
    }

    try {
        // Update vote di database jika belum pernah voting
        const result = await pool.query('UPDATE votes SET vote = $1 WHERE uuid = $2 AND vote = 0 RETURNING *', [vote, uuid]);

        if (result.rowCount === 0) {
            // Jika tidak ada baris yang ter-update, berarti QR Code sudah digunakan untuk voting
            return res.render('invalid', { message: 'QR Code sudah digunakan untuk voting.' });
        }

        // Voting berhasil
        res.render('success', { message: 'Terima kasih telah melakukan voting!' });
    } catch (err) {
        console.error('Error updating vote in database', err);
        res.status(500).send('Error processing vote');
    }
});

// Menjalankan server di port 3000
const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
