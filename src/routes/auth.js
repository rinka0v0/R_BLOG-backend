const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { route } = require('.');
const app = require('../app');
const config = require('../config/auth.config');
const mysql = require('mysql');

// 鍵の設定
const SECRET_KEY = "abcdefg";
const PUBLIC_KEY = "lsjdfdd";

const con = mysql.createConnection({
    host: 'mysql_host',
    user: 'root',
    password: 'root',
    port: '3306',
    database: 'mysql_dev'
});

router.get('/', function(req, res, next) {

    // MYSQLへの接続
    con.connect(function(err) {
        const sql = "select * from test";
        con.query(sql, function (err, result, fields) {  
        res.send(result);
        });
    });
});

// 新規アカウント作成の処理
router.post('/signup', function(req, res) {
    const name = req.body.name;
    const password = req.body.password;
    const sql = `INSERT INTO users (name, password, created) VALUES(${name}, ${password}, NOW())`;

    // データーベースへ接続
    con.connect(function(err) {
        con.query(sql, (err, results, fields) => {
        });
    });

    //jwt発行
    const payload = {
        uname: name
    };
    const option = {
        expiresIn: '24h'
    }
    const token = jwt.sign(payload, SECRET_KEY, option);
    res.status(200).json({
        message: "create token" , 
        name: name,
        token: token
    });
});

// 確認用ミドルウェア
const auth = (req, res, next) => {
    let token = "";
    if(req.headers.authorization &&
       req.headers.authorization.split(' ')[0] === "Bearer") {
           token = req.headers.authorization.split(' ')[1];
       } else {
           return next("token none");
       }

    const option = {
        algorithms: 'RS256'
    }

    jwt.verify(token, PUBLIC_KEY, option, function(err, decoded) {
        if (err) {
            next(err.message)
        } else {
            req.decoded = decoded;
            next();
        }
    });
}


module.exports = router;
