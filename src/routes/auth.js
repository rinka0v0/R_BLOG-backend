const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { route } = require('.');
const mysql = require('mysql');
const { json } = require('express');
const cookie = require('cookie');

// 鍵の設定
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const con = mysql.createConnection({
    host: 'mysql_host',
    user: 'root',
    password: 'root',
    port: '3306',
    database: 'mysql_dev'
});

// 新規アカウント作成の処理
router.post('/signup', (req, res) => {
    const user_name = req.body.name;
    const password = req.body.password;
    con.connect((err) => {
        const selectSql = "SELECT * FROM user WHERE name = ?";
        con.query(selectSql, [user_name], (err, result, fields) => {
            if(result.length) {
                res.status(422).json({
                    error: 'alredy exist!'
                });
            } else {
                const insertSql = "INSERT INTO user (name, password) VALUES (?, ?)";
                con.query(insertSql, [user_name, password], (err, result, fields) => {
                    // jwt発行
                    const payload = {
                        user_id: result.insertId
                    };
                    const option = {
                        expiresIn: '24h'
                    };
                    jwt.sign(payload,PRIVATE_KEY,option,(err, token) => {
                        res.cookie('token', token, { httpOnly: true });
                        res.status(200).json({
                        user_id: result.insertId,
                        });
                    });
                });
            }
        })
    });
});

// ログイン処理
router.post('/login', (req, res) => {
    const user_name = req.body.name;
    const password = req.body.password;
    const sql = "SELECT * FROM user WHERE name=? AND password=?";
    con.connect((err) => {
        con.query(sql,[user_name,password],(err, result, fields) => {
            if(!result.length) {
                res.status(404).json({
                    error: 'not found account!!'
                });
            } else {
                // jwt発行
                const payload = {
                    user_id: result[0].id
                };
                const option = {
                    expiresIn: '1h'
                };
                jwt.sign(payload,PRIVATE_KEY,option,(err, token) => {
                    res.cookie('token', token, { httpOnly: true});
                    res.status(200).json({
                        user_id: result[0].id,
                    });
                });
            }
        });
    });
});

// token確認ミドルウェア
const auth = (req, res, next) => {
    const token = req.cookies.token;
    if(token) {
        //トークンの検証
        jwt.verify(token, PRIVATE_KEY, function(err, decoded) {
            if (err) {
                return res.status(403).json({
                    error: 'Invalid token'
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(404).json(null).json({
            error: 'Not provided token!'
        });
    }
}

// ユーザー情報確認
router.get('/me',auth,(req, res) => {
    res.status(200).json({
        message: `your id is ${req.decoded.user_id}`,
        user_id: req.decoded.user_id
    });
});

//ログアウトの処理
router.get('/logout', auth, (req, res) => {
    res.clearCookie('token');
    res.status(200).json({
        message: 'logout!!'
    })
});

// 記事を投稿する処理
router.post('/post',auth,(req, res) => {
    const sql = `INSERT INTO blog (title, body, user_id) VALUES (?, ?, ?)`;
    con.connect((err) => {
        con.query(sql,[req.body.title, req.body.data, req.decoded.user_id] ,(err, result, fields) => {
            if(err) {
                res.json({
                    error: 'failed post'
                }); 
            } else {
                res.json({
                    result: result
                });
            }
        });
    });
});

// 記事を取り出す処理
router.get('/blogs', (req, res) => {
    con.connect((err) => {
        const sql = "SELECT * FROM blog";  
        con.query(sql, (err, result, fields) => {
            res.json({
                results: result
            });
        });
    });
});

router.get('/blogs/:id', (req, res) => {
    con.connect((err) => {
        const sql = "SELECT * FROM blog WHERE id=?"
        con.query(sql,[req.params.id], (err,result, fields) => {
            if(!result.length) {
                res.status(404).json({
                    error: 'not found article!!'
                });
            }else {
                res.json({
                    results: result
                });
            }
        })
    })
})

module.exports = router;