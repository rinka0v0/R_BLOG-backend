const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mysql = require("mysql");
const { json } = require("express");
const cookie = require("cookie");
const { token } = require("morgan");

const allowCrossDomain = function (req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.APP_URL);
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, access_token"
  );
  // intercept OPTIONS method
  if ("OPTIONS" === req.method) {
    res.send(200);
  } else {
    next();
  }
};

router.use(allowCrossDomain);

// 鍵の設定
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// MYSQLに接続
// const con = mysql.createConnection({
//     host: process.env.MYSQL_HOST,
//     user: process.env.MYSQL_USER,
//     password: process.env.MYSQL_PASSWORD,
//     // port: process.env.MYSQL_PORT,
//     database: process.env.MYSQL_DATABASE
// });

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: "utf8mb4",
});

// UTCをJSTへ変換する関数
const convertJstDate = (time) => {
  // const time = result[0].created_at;
  time.setHours(time.getHours() + 9);
  const createdDate = time.toString().substr(0, 15);
  return createdDate;
};

// 新規アカウント作成の処理
router.post("/signup", (req, res) => {
  const user_name = req.body.name;
  const password = req.body.password;
  pool.getConnection((err, connection) => {
    const selectSql = "SELECT * FROM user WHERE name = ?";
    connection.query(selectSql, [user_name], (err, result, fields) => {
      if (result.length) {
        res.status(422).json({
          error: "alredy exist!",
        });
      } else {
        const insertSql = "INSERT INTO user (name, password) VALUES (?, ?)";
        connection.query(
          insertSql,
          [user_name, password],
          (err, result, fields) => {
            // jwt発行
            const payload = {
              user_id: result.insertId,
            };
            const option = {
              expiresIn: "1h",
            };
            jwt.sign(payload, PRIVATE_KEY, option, (err, token) => {
              // res.cookie('token', token, { httpOnly: true });
              res.status(200).json({
                user_id: result.insertId,
                token: token,
              });
            });
          }
        );
      }
      connection.release();
    });
  });
});

// ログイン処理
router.post("/login", (req, res) => {
  const user_name = req.body.name;
  const password = req.body.password;
  const sql = "SELECT * FROM user WHERE name=? AND password=?";
  pool.getConnection((err, connection) => {
    connection.query(sql, [user_name, password], (err, result, fields) => {
      if (!result.length) {
        res.status(404).json({
          error: "not found account!!",
        });
      } else {
        // jwt発行
        const payload = {
          user_id: result[0].id,
        };
        const option = {
          expiresIn: "1h",
        };
        jwt.sign(payload, PRIVATE_KEY, option, (err, token) => {
          // res.cookie('token', token, { httpOnly: true});
          res.status(200).json({
            user_id: result[0].id,
            token: token,
          });
        });
      }
      connection.release();
    });
  });
});

// token確認ミドルウェア(jwtをcookieでhttpOnlyな値として扱う場合)
// const auth = (req, res, next) => {
//     const token = req.cookies.token;
//     if(token) {
//         //トークンの検証
//         jwt.verify(token, PRIVATE_KEY, function(err, decoded) {
//             if (err) {
//                 return res.status(403).json({
//                     error: 'Invalid token'
//                 });
//             } else {
//                 req.decoded = decoded;
//                 next();
//             }
//         });
//     } else {
//         return res.status(404).json(null).json({
//             error: 'Not provided token!'
//         });
//     }
// }

// 認証用ミドルウェア(jwtをリクエストヘッダのauthorizationにBearerスキームで送られてくる場合)
const auth = (req, res, next) => {
  // リクエストヘッダーからトークンの取得
  if (
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "Bearer"
  ) {
    const token = req.headers.authorization.split(" ")[1];
    // トークンの検証
    jwt.verify(token, PRIVATE_KEY, function (err, decoded) {
      if (err) {
        // 認証NGの場合
        return res.status(403).json({
          error: "Invalid token",
        });
      } else {
        // 認証OKの場合
        req.decoded = decoded;
        next();
      }
    });
  } else {
    return res.status(404).json({
      error: "Not provided token!",
    });
  }
};

// 自分の情報確認
router.get("/me", auth, (req, res) => {
  res.status(200).json({
    message: `your id is ${req.decoded.user_id}`,
    user_id: req.decoded.user_id,
  });
});

// ユーザー情報確認
router.get("/aboutUser/:user_id", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql =
      "SELECT user.name, user.id , COUNT(follow.user_id) AS follow_number , COUNT(follower.follow_id) AS follower_number  FROM user LEFT JOIN follows AS follow  ON user.id=follow.user_id LEFT JOIN follows AS follower ON user.id=follower.follow_id  WHERE user.id=?";
    connection.query(sql, [req.params.user_id], (err, result, fields) => {
      res.json({
        results: result,
      });
      connection.release();
    });
  });
});

//ログアウトの処理(cookieを使った認証の場合に使用)
// router.get('/logout', auth, (req, res) => {
//     res.clearCookie('token');
//     res.status(200).json({
//         message: 'logout!!'
//     })
// });

// 記事を投稿する処理
router.post("/postArticle", auth, (req, res) => {
  const sql = `INSERT INTO blog (title, body, user_id) VALUES (?, ?, ?)`;
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.body.title, req.body.data, req.decoded.user_id],
      (err, result, fields) => {
        if (err) {
          res.json({
            error: "failed post",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

//記事を更新する処理
router.put("/article", auth, (req, res) => {
  const sql = "UPDATE blog SET title=?, body=?, updated_at=NOW() WHERE id=?";
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.body.title, req.body.data, req.body.blog_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "failed edit article",
          });
        } else {
          res.json({
            result: result,
          });
        }
      }
    );
  });
});

//記事にいいねをする処理
router.post("/like", auth, (req, res) => {
  const sql = `INSERT INTO likes ( blog_id, user_id) VALUES ( ?, ? )`;
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.body.blog_id, req.decoded.user_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "failed like",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

//記事のいいねを削除する処理
router.delete("/like", auth, (req, res) => {
  const sql = `DELETE FROM likes WHERE blog_id=? AND user_id=?`;
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.body.blog_id, req.decoded.user_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "Not found like",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

//記事のいいねの確認
router.get("/like/:id", auth, (req, res) => {
  const sql = `SELECT COUNT(likes.id) AS likes_number FROM likes WHERE blog_id=? AND user_id=?`;
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.params.id, req.decoded.user_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "Not found like",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

// コメントを投稿する処理
router.post("/postComment", auth, (req, res) => {
  const sql = `INSERT INTO comment ( text, user_id, blog_id) VALUES ( ?, ?, ?)`;
  pool.getConnection((err, connection) => {
    connection.query(
      sql,
      [req.body.text, req.decoded.user_id, req.body.blog_id],
      (err, result, fields) => {
        if (err) {
          res.json({
            error: "failed post",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

// コメントを取り出す処理
router.get("/comment/:id", (req, res) => {
  pool.getConnection((err, connection) => {
    const sql =
      "SELECT  comment.id,comment.user_id ,text,comment.created , name FROM comment , user WHERE comment.blog_id=? AND comment.user_id=user.id";
    connection.query(sql, [req.params.id], (err, result, fields) => {
      if (!result.length) {
        res.status(404).json({
          error: "not found article!!",
        });
      } else {
        const createdDate = result.map((article) => {
          const createdTime = convertJstDate(article.created);
          return createdTime;
        });
        const commentList = result.map((comment, index) => {
          comment.created = createdDate[index];
        });
        res.status(200).json({
          results: result,
        });
      }
      connection.release();
    });
  });
});

//コメントを削除する処理
router.delete("/comment", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql = "DELETE FROM comment WHERE id=?";
    connection.query(sql, [req.body.id], (err, result, fields) => {
      if (result.affectedRows === 0) {
        res.status(404).json({
          error: "not found comment!!",
        });
      } else {
        res.status(200).json({
          message: "delete!!",
        });
      }
      connection.release();
    });
  });
});

// 記事を全て取り出す処理
router.get("/blogs", (req, res) => {
  pool.getConnection((err, connection) => {
    const sql =
      "SELECT blog.id, blog.title, blog.body ,user.name ,COUNT(likes.id) AS likes_number FROM blog LEFT JOIN user ON blog.user_id = user.id LEFT JOIN likes ON blog.id = likes.blog_id  GROUP BY blog.id ORDER BY blog.id DESC";
    connection.query(sql, (err, result, fields) => {
      res.json({
        results: result,
      });
      connection.release();
    });
  });
});

// 記事を1つ取り出す処理
router.get("/blogs/:id", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql =
      "SELECT blog.id, title, body, blog.user_id,created_at, updated_at,name  FROM blog, user WHERE blog.user_id=user.id AND blog.id=?";
    connection.query(sql, [req.params.id], (err, result, fields) => {
      if (!result.length) {
        res.status(404).json({
          error: "not found article!!",
        });
      } else {
        const createdDate = convertJstDate(result[0].created_at);
        result[0].created_at = createdDate;
        res.status(200).json({
          results: result,
        });
      }
      connection.release();
    });
  });
});

// あるユーザーの記事一覧を取得する処理
router.get("/blogs/user/:userId", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql =
      "SELECT blog.id , blog.title , blog.body , user.name ,COUNT(likes.id) AS likes_number FROM blog LEFT JOIN user ON blog.user_id = user.id LEFT JOIN likes ON blog.id=likes.blog_id  WHERE blog.user_id=? GROUP BY blog.id ORDER BY blog.id DESC";
    connection.query(sql, [req.params.userId], (err, result) => {
      res.json({
        results: result,
        userId: req.params.userId,
      });
      connection.release();
    });
  });
});

// 記事を削除する処理
router.get("/delete/:id", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql = "DELETE FROM blog WHERE id=?";
    connection.query(sql, [req.params.id], (err, result, fields) => {
      res.status(200).json({
        message: "deleted!",
      });
      connection.release();
    });
  });
});

//フォローする処理
router.post("/follow", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql = `INSERT INTO follows ( user_id, follow_id) VALUES ( ?, ?)`;
    connection.query(
      sql,
      [req.decoded.user_id, req.body.follow_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "failed follow",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

//フォローを削除する処理
router.delete("/follow", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql = "DELETE FROM follows WHERE user_id=? AND follow_id=?";
    connection.query(
      sql,
      [req.decoded.user_id, req.body.follow_id],
      (err, result) => {
        if (result.affectedRows === 0) {
          res.status(404).json({
            error: "not found follow!!",
          });
        } else {
          res.status(200).json({
            message: "delete!!",
          });
        }
        if (err) {
          res.json({
            error: "somothing  error",
          });
        }
        connection.release();
      }
    );
  });
});

// フォローしているかの確認
router.get("/follow/:follow_id", auth, (req, res) => {
  pool.getConnection((err, connection) => {
    const sql = "SELECT COUNT(follows.id) AS follow FROM follows WHERE user_id=? AND follow_id=?";
    connection.query(
      sql,
      [req.decoded.user_id, req.params.follow_id],
      (err, result) => {
        if (err) {
          res.json({
            error: "Not found follow",
          });
        } else {
          res.json({
            result: result,
          });
        }
        connection.release();
      }
    );
  });
});

module.exports = router;
