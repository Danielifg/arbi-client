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

    let {loanInfo,strategies} = req && req.body;
    
    const successMsg = 
        strategies.length > 0?
            `Status 200 \nNumber of strategies received ${strategies.length}`:
            'Status 500';

    // console.log(loanInfo,strategies)
    res.send(successMsg);
});

app.route('/v1/heartbeat').post((req, res) => { 
    console.log("heartbeat... beating!")
    return res.send(`Arbi client listening on port ${port}`)
});

  
app.listen(port, () => {
    console.log(`Flash Quoter listening on port ${port}`)
});


// TODO better Error handling with log libs
// https://blog.heroku.com/best-practices-nodejs-errors
process.on('uncaughtException', function(err) {
	console.log('UnCaught Exception 83: ' + err);
	console.error(err.stack);
	fs.appendFile('./critical.txt', err.stack, function(){ });
});

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: '+p+' - reason: '+reason);
});


