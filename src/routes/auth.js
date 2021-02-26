const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { route } = require('.');
const mysql = require('mysql');
const { json } = require('express');

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
    const sql = "INSERT INTO user (name, password) VALUES (?, ?)";
    con.connect((err) => {
        con.query(sql, [user_name, password], (err, result, fields) => {
            // jwt発行
            const payload = {
                user_id: result.insertId
            };
            const option = {
                expiresIn: '24h'
            };
            jwt.sign(payload,PRIVATE_KEY,option,(err, token) => {
                res.status(200).json({
                    token: token
                });
            });
        });
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
                res.json({
                    message: 'not found account!!'
                });
            } else {
                // jwt発行
                const payload = {
                    user_id: result[0].id
                };
                const option = {
                    expiresIn: '24h'
                };
                jwt.sign(payload,PRIVATE_KEY,option,(err, token) => {
                    res.status(200).json({
                        user_id: result[0].id,
                        token: token
                    });
                });
            }
        });
    });
});

// 確認用ミドルウェア
const auth = (req, res, next) => {
    let token = "";
    if(req.headers.authorization && req.headers.authorization.split(' ')[0] === "Bearer") {
           token = req.headers.authorization.split(' ')[1];
        } else { 
            return res.status(403).json({
                message: 'No token provided'
            });
        }
    //トークンの検証
    jwt.verify(token, PRIVATE_KEY, function(err, decoded) {
        if (err) {
            return res.json({
                message: 'Invalid token'
            });
        } else {
            req.decoded = decoded;
            next();
        }
    });
};

// jwt確認用
router.get('/user',auth,(req, res) => {
    res.json({
        message: `your name is ${req.decoded.user_name}`
    });
});

// 記事を投稿する処理
router.post('/post',auth,(req, res) => {
    const data = JSON.stringify(req.body.data);
    const sql = `INSERT INTO blog (title, body, user_id) VALUES (${req.body.title}, ${data}, 1)`;
    con.connect((err) => {
        con.query(sql, (err, result, fields) => {
            if(err) {
                res.json({
                    message: 'error'
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
router.get('/blogs',auth, (req, res) => {
    con.connect((err) => {
        const sql = "SELECT * FROM blog";  //個数に制限なし
        con.query(sql, (err, result, fields) => {
            const data = JSON.parse(result[0].body);
            res.json({
                results: result[0],
                data: data
            });
        });
    });
});

module.exports = router;
