const express = require('express');
const bodyParser = require('body-parser');
const path = require('path')
const cors = require('cors');


const port = 3001;
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(express.static('public'));


app.route('/v1/arbitrage/matic').post((req, res) => { 
    let {loanInfo,strategies} = req.body && req.body.data;
    
    const successMsg = 
        strategies.length > 0?
            `Status 200 \nNumber of strategies received ${strategies.length}`:
            'Status 500';

    console.log(loanInfo,strategies)
    res.send(successMsg);
    // res.sendStatus(status);
});

app.route('/v1/heartbeat').post((req, res) => { 
    console.log("heartbeat... beating!")
    return res.send(`Arbi client listening on port ${port}`)
});

  
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

