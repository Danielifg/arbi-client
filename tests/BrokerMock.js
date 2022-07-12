const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path')
const axios = require('axios');
const cors = require('cors');

const port = 3000;
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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


const WEB2_PROTOCOL = process.env.PROD == true? "https":"http";
const requestOptions = {headers: { "Content-Type": "application/json" }};

function _heartBeat(){
    return new Promise((resolve,reject) => {
        return axios.post(`${WEB2_PROTOCOL}://localhost:3001/v1/heartbeat`,{
           requestOptions
        }).then((response) => {
            console.log(response.data);
            resolve(true);
        },(error) => {
          console.error('ERROR NODE CLIENT - ', error);
          reject(error);
        });
    });
}

function _depositToStrategy(){
  return new Promise((resolve,reject) => {
      const url = 'http://localhost:3002/v1/arbitrage/matic/deposit';
          return axios.post(url, {
              requestOptions,
          }).then((response) => {
              console.log(response.data)
              return response.data;
          },(error) => {
            console.error('Arbi client service error - ', error);
          });
      });
}

function _postStrategy(strategy){
    return new Promise((resolve,reject) => {
        const url = 'http://localhost:3002/v1/arbitrage/matic';
            return axios.post(url, {
                requestOptions,
                body: strategy
            }).then((response) => {
                console.log(response.data)
                return response.data;
            },(error) => {
              console.error('Arbi client service error - ', error);
            });
        });
}

const _testStrategy = [
    { 
      loanInfo:{ amount: 1000, asset: WMATIC },
      strategies:   [
        {
          dexSymbol: { dexA: 'uniswap', dexB: 'gravityfinance' },
          tokenA: WMATIC,
          tokenB: AAVE ,
          pool: {
            poolA: '0x9F2b55f290fb1dd0c80d685284dbeF91ebEEA480',
            poolB: '0x167384319B41F7094e62f7506409Eb38079AbfF8'
          },
          priceA: 2121.1,
          priceB: 2295.57
        }
      ]     
    },
  ]


const _perform = () =>  {
  _depositToStrategy();
  // _testStrategy.forEach(str => {
  //   console.log('2')
  //   _postStrategy( str )
  // });
}
_perform();
