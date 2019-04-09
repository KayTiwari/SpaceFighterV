const express = require("express");
const scoreRouter = express.Router();
const Score = require("../models/score");

scoreRouter.get("/", (req, res) => {
        Score.find((err, scores) => {
            if(err) {
                res.status(500)
                return res.send(err);
            } else {
                res.status(200)
                return res.send(scores)
            }
        })
    })

scoreRouter.post("/", (req, res) => {
    console.log(req.body);
    const newScore = new Score(req.body);
    newScore.save((err, newScoreinfo) => {
        err && res.status(500).send(err);
        return res.status(200).send(newScoreinfo);
    })
})




scoreRouter.delete("/:_id", (req, res, next) => {
    Score.findOneAndDelete({_id: req.params._id},
                (err) => {
                    err && res.status(500).send(`Item not deleted, ${err}`);
                    return res.status(200).send('Item successfully deleted')
                }
)});

module.exports = scoreRouter;