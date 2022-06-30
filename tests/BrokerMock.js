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
const AAVE =  "0xD6DF932A45C0f255f85145f286eA0b292B21C90B"; //18 decimals
const WETH =  "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"; // 18 decimals
const DAI  =  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"; //18 decimals
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const USDC= "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // 6 decimals
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

function _postStrategy(strategy){
    return new Promise((resolve,reject) => {
        const url = 'http://localhost:3001/v1/arbitrage/matic';
            return axios.post(url, {
                requestOptions,
                data: strategy
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
      loanInfo:{ amount: 100, asset: AAVE },
      strategies:  [
            {
              dexSymbol: { dexA: 'uniswap', dexB: 'sushiswap' },
              tokenA: AAVE,
              tokenB: WETH,
              pool: {
                poolA: '0xBD934A7778771A7E2D9bf80596002a214D8C9304',
                poolB: '0x0e44cEb592AcFC5D3F09D996302eB4C499ff8c10'
              },
              priceA: 1223.84,
              priceB: 1238.59
            },
          ]
    }
  ]

const _perform = () =>  {
  _testStrategy.forEach(str => {
    console.log('2')
    _postStrategy( str )
  });
}
_perform();
