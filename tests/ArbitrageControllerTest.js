'use strict';
const dotenv = require("dotenv");
dotenv.config();

const {BigNumber} =require( "ethers");
const {ethers,Wallet} = require('ethers');
const {getTraderContract} = require('../src/utils/getContracts');
const fork_deployment_address = "0x69d2ffc1927146Dc0Fc18C7e41b8Bdd2167865DD";

const ArbitrageController = require('../src/ArbitrageController.js');
// polygon
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const AAVE =  "0xD6DF932A45C0f255f85145f286eA0b292B21C90B"; //18 decimals
const DAI =  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"; //18 decimals
const USDC =  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // 6 decimals
const USDT =  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // 6 decimals
const WBTC =  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"; // 8 decimals
const WETH =  "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"; // 18 decimals
const WMATIC =  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"; // 18 decimals
const oneINCH = "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f";    

const ALCHEMY_FREE_NODE = "https://polygon-mainnet.g.alchemy.com/v2/5-5xZ9rGcQjCOWrg-P0VBZbvfr4EqNpc";
const READ_NODE = "https://polygon-rpc.com/";

const provider = new ethers.providers.JsonRpcProvider( READ_NODE );
const signer = new Wallet (  process.env.PRIVATE_KEY_POC, provider );

let _testStrategy = 
    { 
      loanInfo:{ amount: 1000, asset: AAVE },
      strategies:   [
        {
          dexSymbol: { dexA: 'uniswap', dexB: 'sushiswap' },
          tokenA: USDC,
          tokenB: AAVE ,
          pool: {
            poolA: '0x9F2b55f290fb1dd0c80d685284dbeF91ebEEA480',
            poolB: '0x167384319B41F7094e62f7506409Eb38079AbfF8'
          },
          priceA: 2121.1,
          priceB: 2295.57
        }
      ]     
    }
;

async function _getController(){
    const PROVIDER = new ethers.providers.JsonRpcProvider(ALCHEMY_FREE_NODE);
    const CHAIN_ID = 137;
    const CONTRACT = await getTraderContract(fork_deployment_address,signer);
    const SLIPPAGE = 300; // 3000 /10000 = 0.3

    return await new ArbitrageController (
        PROVIDER,
        CHAIN_ID,
        CONTRACT,
        SLIPPAGE
    );
}

async function formatStrategyTest(STRAT){
    const Contract = await _getController();
    await Contract.formatStrategy('01',STRAT)
    .then( encode => console.log( encode ));
}

formatStrategyTest(_testStrategy);