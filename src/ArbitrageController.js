
'use strict';
const {BigNumber} =require( "ethers");
const ethers = require('ethers');
const UniswapV3Api = require('./quote/uniswap/UniswapV3');
const IERC20abi = require('./abi/ERC20.json');
const Web3 = require('web3');
const web3 = new Web3();
const { 
    ASSETS,
    GRAVITYFINANCE,
    DFYN,
    QUICKSWAP,
    BALANCERV2,
    AAVE,
    SUSHI,
    KYBER,
    UNISWAP_V2,
    UNISWAP_V3,
    DYDX,
    TREASURY
} = require('./utils/address_lookup');

/**
 * JS controller 4 Flash loan Arbitrage Contract
 * @author FlashBoyz team
 * @version 1.0.1
 */
module.exports = class ArbitrageController { 

    /**
     * Init Arbitrage contract controller (SDK)
     * @param {*} provider ether with node url
     * @param {*} chainId 
     * @param {*} arbitrageContract ethers contract instance
     * @param {*} slippageTolerance global slippage set from server
     */
    constructor(provider, chainId, arbitrageContract, slippageTolerance){
        this.provider = provider;
        this.network = 'matic'; // TODO dynamic
        this.chainId = chainId;
        this.ArbitrageContract = arbitrageContract;
        this.UniswapV3Api = new UniswapV3Api();
        this.slippage = slippageTolerance;

    }

    /**
     * To Access contract address from server
     * @returns arbitrageTrader.sol address
     */
    async getControllerAddress(){
        return this.ArbitrageContract.address;
    }

    /**
     * To Access class provider from server
     * @returns ethers object provider
     */
    async getProvider(){
        return this.provider;
    }

    /**
     * Set Slippage at global scope
     * @param {*} slippage 
     */
    async setGlobalSlippage(slippage){
        this.slippage = slippage;
    }

    /**
     * Initial deposit into strategy contract for gasFees
     * @param {*} wallet trader wallet funds
     * @param {*} _depositAmount amount to manage fees
     * @returns amount on strategy contract (arbitrage trader .sol)
     */
    async deposit(wallet,_depositAmount){
        let tx = { 
          to: this.ArbitrageContract.address,
          value:_depositAmount.toString(),
          gasPrice: 44000000000
        };
    
        await wallet.sendTransaction(tx)
        .then((txObj) => {console.log('txHash', txObj.hash)})
        .catch(err => console.log('ERROR',err));
      
        const traderBalance = await this.provider.getBalance(this.ArbitrageContract.address);
        console.log('Arbitrage contract Balance: ',traderBalance.toString());
        return traderBalance.toString();
    }
    
    /**
     * Dynamic select of router 
     * @param {*} _dexName 
     * @returns dex router address and dex symbol
     */
     _selectRouterDetails(_dexName){
        let _dexRouterAddress = null;
        let _dexSymbol = null;

        switch(_dexName){
            case 'gravityfinance':
                _dexRouterAddress = GRAVITYFINANCE.router[this.network];
                _dexSymbol = 'GRAVITY';
                break;
            case 'dfyn':
                _dexRouterAddress = DFYN.router[this.network];
                _dexSymbol = 'DFYN';
                break;
            // case 'balancer':
            //     _dexRouterAddress = BALANCERV2.valut[network]; // not POC
            //     _dexSymbol = 'BALANCER';
            //     break;
            case 'quick':
                _dexRouterAddress = QUICKSWAP.router[this.network];
                _dexSymbol = 'QUICK';
                break;
            case 'sushiswap':
                _dexRouterAddress = SUSHI.router[this.network];
                _dexSymbol = 'SUSHI';
                break;
            case 'uniswap':
                _dexRouterAddress = UNISWAP_V3.swapRouter;
                _dexSymbol = 'UNIV3';
                break;
            default:
                break;
        }
        return [_dexSymbol,_dexRouterAddress]
    }

    /**
     * Encode strategy for contract params
     * @param {*} id 
     * @param {*} strategyObject 
     * @returns 
     */
    async formatStrategy(id, strategyObject){
        let {loanInfo,strategies} = JSON.parse(JSON.stringify(strategyObject));
        console.log('Controller receive obj: ',loanInfo,strategies)

        const abiCoder = await ethers.utils.defaultAbiCoder;
        const Strategy = new Object();

        Strategy._strategyId = id,
        Strategy._strategyLength =  strategies.length,
        Strategy._lenderSymbol = await this._selectLoanProvider(),
        Strategy._loanAsset =  loanInfo.asset,
        Strategy._loanAmount = loanInfo.amount,
        Strategy._ops = [];
        
        let operation = strategies[0];

// *********************** *********************** *********************** 
                          // Operation 1
// *********************** *********************** *********************** 

            let [ _dexSymbol, _dexRouterAddress ] = await this._selectRouterDetails(operation.dexSymbol.dexA);
            let _priceA = Math.round(operation.priceA);

            let _amountIn_1 = _dexSymbol === 'UNIV3'? 
                await this._formatTokenAmount(operation.tokenA, Strategy._loanAmount) : Strategy._loanAmount;

            let [ _expectedAmountOut,_path, _poolFees ] = await this._selectRoutePath(
                                                                        _dexSymbol,
                                                                        operation.tokenA, operation.tokenB,
                                                                        _amountIn_1.toString(),
                                                                        _priceA,
                                                                        false // not second swap
                                                                    );

            _expectedAmountOut = await this._formatTokenAmount(operation.tokenB, _expectedAmountOut);
            _priceA = await this._formatTokenAmount(operation.tokenB, _priceA);

            console.log('swap1:',[ _dexSymbol, _dexRouterAddress, _amountIn_1.toString(), _expectedAmountOut.toString(),_priceA.toString(), _path, _poolFees ]);

// *********************** *********************** ***********************
                          // Operation 2
// *********************** *********************** ***********************

            let _amountIn_2 = _dexSymbol === 'UNIV3'? 
            await this._formatTokenAmount(operation.tokenB, _expectedAmountOut) : _expectedAmountOut;

            let [ _dexSymbol2, _dexRouterAddress2 ] = await this._selectRouterDetails(operation.dexSymbol.dexB);
            let _priceB = Math.round(operation.priceB);
            let [ _expectedAmountOut2, _path2, _poolFees2 ] = await this._selectRoutePath(
                                                                        _dexSymbol2,
                                                                        operation.tokenA,
                                                                        operation.tokenB, 
                                                                        _amountIn_2.toString(), // if 0,this amountIn is calculated on chain 
                                                                        _priceB,
                                                                        true // second swap
                                                                    );

            // AmountIn_2 is result of the first swap on chain, but for a swap at UniV3 
            // we need an approx amount to get the optimal router path, pools and fees from Alpha Router
            _amountIn_2 = _expectedAmountOut > 0 ?  await this._formatTokenAmount(operation.tokenB, _amountIn_1) : 0;
            _expectedAmountOut2 = 0; // second out , loadn  + fees :: await this._formatTokenAmount(_path[1],_expectedAmountOut2);
            _priceB = await this._formatTokenAmount(operation.tokenB , _priceB);

            // console.log('_expectedAmountOut2: ',_expectedAmountOut2)
            const _expectedAmountOut_2 = 0
            // _expectedAmountOut2 !== 0 ? web3.utils.toWei(_expectedAmountOut2.toString()) : 0;

            console.log('swap2: ',[ _dexSymbol2, _dexRouterAddress2, _amountIn_2.toString(), _expectedAmountOut_2.toString(), _priceB.toString(), _path2, _poolFees2 ])

// *********************** *********************** ***********************
                          // Encode
// *********************** *********************** ***********************

        const operation_1 = abiCoder.encode(
                [ 'string', 'address', 'uint256','uint256','uint256','address[]','uint24[]'],
                [ _dexSymbol, _dexRouterAddress, _amountIn_1, _expectedAmountOut,
                    _priceA, _path, _poolFees ]);

            const operation_2 = abiCoder.encode(
                [  'string', 'address', 'uint256','uint256','uint256','address[]','uint24[]'],
                [ _dexSymbol2, _dexRouterAddress2, _amountIn_2, _expectedAmountOut_2, _priceB, _path2, _poolFees2 ]
            );

        Strategy._ops.push(operation_1);
        Strategy._ops.push(operation_2);
        return Strategy;
    }


    /**
     * TODO: implement multi loan provider 
     * module on contract and controller
     * 
     * @returns only "AAVE" for the mean time
     */
    async _selectLoanProvider(){
        return "AAVE";
    }

    /**
     *  Select uni v2 or v3 route and amount out
     * @param {*} _dexSymbol 
     * @param {*} _tokenA 
     * @param {*} _tokenB 
     * @param {*} _amountIn 
     * @param {*} _price 
     * @param {*} _isSecondSwap 
     * @returns 
     */
    async _selectRoutePath(_dexSymbol, _tokenA, _tokenB, _amountIn, _price, _isSecondSwap){
        let _expectedAmountOut = 0, _path = [], _poolFees = [];

// *********************** *********************** *********************** 
                          // Get UNIv3 route & out
// *********************** *********************** *********************** 
        if(_dexSymbol === 'UNIV3'){   // this covers having uniV3 as first & 2nd swap
            const path = _isSecondSwap ? [_tokenB,_tokenA] : [_tokenA,_tokenB];
            
            console.log('(path, _amountIn):', path, _amountIn);

            const route = await this._getUniswapV3Route(path, _amountIn).then( route => {
                _path =  route._routeDataFormated.path;
                _poolFees = route._routeDataFormated.poolFees;
                return route;
            });
            console.log('route: ',route)
            _expectedAmountOut = route.amountOut;

            // Quote with Dex Screener price
            const uniswapPriceFeed = false;
            if(uniswapPriceFeed && !_isSecondSwap){
                _amountIn = BigNumber.from(_amountIn.toString()).mul(_price);
                _expectedAmountOut = _amountIn - (_amountIn * (this.slippage / 10000));
            }
// *********************** *********************** *********************** 
                          // Get UNI V2 route & out
// *********************** *********************** *********************** 
        } else {
            if(_amountIn !== 0){  // we calculate _expectedOut_1
                const path = _isSecondSwap ? [_tokenB,_tokenA] : [_tokenA,_tokenB];

                // subtract slippage % of _amountIn
                _amountIn = BigNumber.from(_amountIn.toString()).mul(_price);
                _expectedAmountOut = _amountIn - (_amountIn * (this.slippage / 10000));
            } 
            // not uni V3 and inverse path if _isSecondSwap =  true
            _path = _isSecondSwap ? [_tokenB, _tokenA] : [_tokenA, _tokenB];
            _poolFees = [0];
        }
        return [_expectedAmountOut,_path, _poolFees ];
    }



    /**
     * Query Uniswap V3 API for quote and route
     * @param {*} path tokenA tokenB
     * @param {*} amountIn 
     * @returns amountOut, route & pool fees
     */
    async _getUniswapV3Route(path,amountIn){
        amountIn = await this._formatTokenAmount(path[0], amountIn);
        return new Promise((resolve, reject) => {
            const route = this.UniswapV3Api.getTokenAPrice(
                this.provider,
                this.chainId, 
                path[0],
                amountIn,
                path[1],
                this.slippage
            );
            resolve(route);
        });
    }

    /**
     * Format any amount to its respective token decimals
     * @param {*} _tokenAddress 
     * @param {*} amount 
     * @returns formatted amount
     */
    async _formatTokenAmount(_tokenAddress,amount){
        const tokenInstance = await new ethers.Contract(_tokenAddress,IERC20abi.abi, this.provider);
        const _decimals = await tokenInstance.decimals();
        return ethers.utils.parseUnits(amount.toString(),_decimals);
    }
}