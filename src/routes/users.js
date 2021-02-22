var express = require('express');
var router = express.Router();
const jwt = require("jsonwebtoken");
const { route } = require('.');
const app = require('../app');

// 鍵の設定
const SECRET_KEY = "abcdefg";
const PUBLIC_KEY = "lsjdfdd";

// jwt発行API
router.get('/', function(req, res) {
    const payload = {
        user: req.body.user
    };
    const option = {
        expiresIn: '1m'
    }
    const token = jwt.sign(payload, SECRET_KEY, option);
    res.json({
        message: "create token" , 
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

router.get('/user', auth, (req, res) => {
    res.send(200, `your name is ${req.decoded.user}`);
});

module.exports = router;
