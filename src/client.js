const dotenv = require("dotenv");
dotenv.config();
const ethers = require('ethers');
const write_node =`https://twilight-icy-log.matic.quiknode.pro/${process.env.NODE_POLY_KEY}`;
const read_node = "https://polygon-rpc.com/";
const {BigNumber} =require( "ethers")


const provider = new ethers.providers.JsonRpcProvider(write_node);
