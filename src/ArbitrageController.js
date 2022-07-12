
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

module.exports = class ArbitrageController { 

    constructor(provider, chainId, arbitrageContract, slippageTolerance){
        this.provider = provider;
        this.network = 'matic'; // TODO dynamic
        this.chainId = chainId;
        this.ArbitrageContract = arbitrageContract;
        this.UniswapV3Api = new UniswapV3Api();
        this.slippage = slippageTolerance;

    }

    async getControllerAddress(){
        return this.ArbitrageContract.address;
    }

    async getProvider(){
        return this.provider;
    }
    async setGlobalSlippage(slippage){
        this.slippage = slippage;
    }

    async deposit(wallet,_depositAmount){
        let amountInEther = ethers.utils.formatEther(_depositAmount.toString());
        let tx = { 
          to: this.ArbitrageContract.address,
          value: ethers.utils.parseEther(amountInEther)
        };
    
        await wallet.sendTransaction(tx)
        .then((txObj) => {console.log('txHash', txObj.hash)})
        .catch(err => console.log(err));
      
        const traderBalance = await this.provider.getBalance(this.ArbitrageContract.address);
        console.log('Arbitrage contract Balance: ',traderBalance.toString());
        return traderBalance;
    }
    
    /**
     * Dynamic select of router 
     * @param {*} _dexName 
     * @returns 
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

    async _formatTokenAmount(_tokenAddress,amount){
        const tokenInstance = await new ethers.Contract(_tokenAddress,IERC20abi.abi, this.provider);
        const _decimals = await tokenInstance.decimals();
        return ethers.utils.parseUnits(amount.toString(),_decimals);
    }

    async _decimalConverter(_amountA, path){

        const tokenAInstance = await new ethers.Contract(path[0],IERC20abi.abi, this.provider);
        const tokenBInstance = await new ethers.Contract(path[1],IERC20abi.abi, this.provider);

        const _decimalsA = await tokenAInstance.decimals();
        const _decimalsB = await tokenBInstance.decimals();


        if (_decimalsA > _decimalsB) {

            let decimals = BigNumber.from(10**(_decimalsA - _decimalsB));
            // console.log(
            //     '_decimalsA: ',_decimalsA,
            //     '_decimalsB: ',_decimalsB,
            // );

            // console.log('a>b',_amountA);
            // console.log('decimals', decimals.toString());

            _amountA = BigNumber.from(_amountA.toString()).mul((decimals.toString()));
            // console.log('_amountA>b',_amountA.toString());

        } else if (_decimalsB > _decimalsA) {

            let decimals = BigNumber.from(10**(_decimalsB - _decimalsA));
            _amountA = BigNumber.from(_amountA.toString()).div(BigNumber.from(decimals.toString()));

        }
        return _amountA;
    }

}


/** loan SNX 1000
 * swap usdc unis Weth for 1223.00 10,000 / 1223.00 = 8.7 WETH
 * swap 8.7 WETH * USDC at 1238.00 = 10770.6
 * pay 10,000
 * gros profit = 770 usdc
 * 
 *           {
                    dexSymbol: { dexA: 'uniswap', dexB: 'sushi' },
                    tokenA: WETH
                    tokeB: SNX 
                    pool: {
                      poolA: '0xBD934A7778771A7E2D9bf80596002a214D8C9304',
                      poolB: '0x0e44cEb592AcFC5D3F09D996302eB4C499ff8c10'
                    },
                    priceA: 1223.84 SNX
                    priceB: 1238.59 SNX
                  },
                ]
             }

              we have

              (swap1 1223 SNX * 1000 WETH) - slippage = amountOut WETHt
              x tokenB in terms of tokenA

              unit USD price of SNX


                // console.log('this.slippage ', this.slippage );
                // console.log('_(_amountIn * (this.slippage / 10000))', (_amountIn * (this.slippage / 10000)));
                // console.log(`_expectedOutput with slippage of ${this.slippage / 10000}:` , _expectedAmountOut);

                                // console.log(` DEX screener quote = _expectedOutput with slippage of ${this.slippage / 10000}:` , _expectedAmountOut);

 */

