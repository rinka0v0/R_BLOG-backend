const express = require('express');
const mysql = require('mysql');
const router = express.Router();

router.get('/', function(req, res, next) {
    const con = mysql.createConnection({
        host: 'mysql_host',
        user: 'root',
        password: 'root',
        port: '3306',
        database: 'mysql_dev'
    });
    // MYSQLへの接続
    con.connect(function(err) {
        // if (err) throw err;
        // console.log('Connected');
        const sql = "select * from test"
        con.query(sql, function (err, result, fields) {  
        // if (err) throw err;  
        res.send(result)
        });
    });
    // res.send('respond with a resource');
});


module.exports = router;