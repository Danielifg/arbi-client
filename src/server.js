'use strict';
const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path')
const fs = require('fs');
const cors = require('cors');
const {BigNumber} =require( "ethers");
const {ethers,Wallet} = require('ethers');
const ArbitrageController = require('./ArbitrageController');
const Web3 = require('web3');

const ArbiTraderABI = require( './abi/ArbiTrader.json');
const ERC20 = require( './abi/ERC20.json');

// const write_node = `https://twilight-icy-log.matic.quiknode.pro/${process.env.NODE_POLY_KEY}`;
// const write_node = `https://twilight-icy-log.matic.quiknode.pro/2d49e0fc113dcba25e5a127bc74a6545b1a9f440`;
const ALCHEMY_FREE_NODE = "https://polygon-mainnet.g.alchemy.com/v2/5-5xZ9rGcQjCOWrg-P0VBZbvfr4EqNpc";

const write_node =`http://localhost:8545`;
const read_node = "https://polygon-rpc.com/";
const {getTraderContract} = require('./utils/getContracts');
const fork_deployment_address = "0xb0761134896a55e5198780d87c13084db004645a";

const port = 3001;
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

/* ** ********* **** TRADE SPECS  **** ** ********* ****/
/* ** ********* **** ** ********* **** ** ********* ****/

// CANNOT BE GREATER THAN 3000
 const slippageTolerance = 300; // 3000 /10000 = 0.3


/* ** ********* **** ** ********* **** ** ********* ****/
/* ** ********* **** ** ********* **** ** ********* ****/

 /**
 * @dev Initializes Js contract instance
 * @returns Arbi-protocol contract instance
 */
async function _getController(){
    console.log('controller running.');    
    const chainId = 137;

    /** Ethers provider */
    // const provider = await new ethers.providers.JsonRpcProvider( write_node );    
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_FREE_NODE);

    const signer = new Wallet (  process.env.PRIVATE_KEY_POC, provider );

    const arbiContract = await getTraderContract(fork_deployment_address,signer);
    
    // const signerBalance = await provider.getBalance(signer.address);

    // await Controller.jsController.deposit(signerBalance);

    // /** WEB· provider */
    // // const web3 = new Web3(write_node);
    // // const poc_wallet = await web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY_POC);
    // // console.log('pocwallet: ',poc_wallet)
    // // const arbiContract = new web3.eth.Contract(ArbiTraderABI.abi,fork_deployment_address);

    return {
       adminWallet : signer,
       contractInstance: arbiContract,
       jsController: await new ArbitrageController (
            provider,
            chainId,
            arbiContract,
            slippageTolerance
    )}
}

/**
 * POC
 * 1.- Receive strategy from broker
 * 2.- Format strategy
 * 3.- Send tx with strategy to contract
 * 4.- Await for tx logs
 * 
 * V1
 * 5.- Query admin balance for profit
 * 6.- Display on controller UI tx logs of profitable strategies per chain
 * 7.- Display contract native asset balance
 * 
 * 
 * const provider = new ethers.providers.Web3Provider(window.ethereum)
º  const signer = provider.getSigner();
º  const contract = new ethers.Contract(contractDeployedAddress, Contract.abi, signer)
º  
º  await contract.someMethodThatRequiresSigning();

 */

app.route('/v1/arbitrage/matic').post( async (req, res) => { 
    console.log(' calling /v1/arbitrage/matic...');
    const Controller = await  _getController();
    console.log('DATA ====>> req',req);
    const payload = req.body && JSON.parse(JSON.stringify(req.body.data));
    console.log('DATA ====>> payload in ',payload);

    const provider = await Controller.jsController.getProvider();
    
    // params: strategy ID & req payload
    const Strategy = await Controller.jsController.formatStrategy('001', payload);
    console.log('Strategy provider: ', Strategy);

    const contractInstance = await Controller.contractInstance;
    //  const tx =  await contractInstance.performStrategy(Strategy,
    //     {
    //         gasLimit:500000
    //     })
    //  console.log('tx',tx)
    //     .send({
    //         from: Controller.adminWallet.address,
    //         gasLimit: 5000000,
    //     }).on('transactionHash', (transactionHash) => {
    //         console.log('transactionHash: ',transactionHash);
    //     }).on('error', (err, receipt) => {
    //         err && console.log('err: ', err.data);
    //         receipt && console.log('receipt: ',receipt);
    //     }).on('confirmation', (confirmationNumber) => {
    //         console.log('confirmationNumber: ',confirmationNumber);
    //     });
        
    
    // const successMsg = 
    //     strategies.length > 0?
    //         `Status 200 \nNumber of strategies received ${strategies.length}`:
    //         'Status 500';

    res.send(200);
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
	console.log('Unhandled Rejection at :: '+JSON.stringify(p)+' - reason: '+ reason);
});




/**
 *             string _dexSymbol;
            address _dexAddress; 
            uint256 _amountIn; 
            uint256 _amountOut; 
            uint256 _spotPrice;
            address[] _paths;
            uint24[] _poolFees;
 */