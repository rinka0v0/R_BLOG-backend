const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { route } = require('.');
const app = require('../app');
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
router.post('/signup', function(req, res) {
    const user_name = req.body.name;
    const password = req.body.password;
    const sql = `INSERT INTO users (name, password, created) VALUES(${user_name}, ${password}, NOW())`;

    // // データーベースへ接続
    con.connect(function(err) {
        con.query(sql, (err, results, fields) => {
            if(!err) {
                res.json({
                    message: 'error'
                })
            } else {
                // jwt発行
                const payload = {
                    user_name: req.body.name
                };
                const option = {
                    expiresIn: '24h'
                };
                jwt.sign(payload,PRIVATE_KEY,option,(err, token) => {
                    res.status(200).json({
                        message: 'token created!',
                        name: user_name,
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

router.get('/user',auth,(req, res) => {
    res.json({
        message: `your name is ${req.decoded.user_name}`
    });
});

// router.get('/user', function(req, res, next) {
//     // MYSQLへの接続
//     con.connect(function(err) {
//         const sql = "select * from users";
//         con.query(sql, function (err, result, fields) {  
//         res.json({
//             result: result,
//             message: req.decoded.name
//         });
//         });
//     });
// });

module.exports = router;
