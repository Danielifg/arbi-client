
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
        const abiCoder = await ethers.utils.defaultAbiCoder;
        const Strategy = new Object();
        Strategy._strategyId = id,
        Strategy._strategyLength =  strategies.length,
        Strategy._lenderSymbol = await this._selectLoanProvider(),
        Strategy._loanAsset =  loanInfo.asset,
        Strategy._loanAmount = loanInfo.amount,
        Strategy._ops = [];
        
        let operation = strategies[0];

        // start strategy loop
            let [ _dexSymbol, _dexRouterAddress ] = await this._selectRouterDetails(operation.dexSymbol.dexA);
            const _priceA = web3.utils.toWei(operation.priceA.toString());
            const _loanAmount = web3.utils.toWei(loanInfo.amount.toString());
            const _amountIn_1 = _loanAmount;
            const [ _expectedAmountOut,_path, _poolFees ] = await this._selectRoutePath(
                                                                        _dexSymbol,
                                                                        operation.tokenA, operation.tokenB,
                                                                        _loanAmount,
                                                                        _priceA,
                                                                        false // not second swap
                                                                        );

            const _expectedAmountOut_1 = _expectedAmountOut !== null ? _expectedAmountOut : 0;
            const operation_1 = abiCoder.encode(
                    [ 'string', 'address', 'uint256','uint256','uint256','address[]','uint24[]'],
                    [ _dexSymbol, _dexRouterAddress, _amountIn_1, _expectedAmountOut_1,
                        _priceA, _path, _poolFees ]
            );

            console.log('swap1:',[ _dexSymbol, _dexRouterAddress, _loanAmount, _expectedAmountOut_1,_priceA, _path, _poolFees ]);

            // operation_2
            let [ _dexSymbol2, _dexRouterAddress2 ] = await this._selectRouterDetails(operation.dexSymbol.dexB);
            // this covers having uniV3 as second swap
            const _amountIn_2 = _dexSymbol2 === 'UNIV3' ? _expectedAmountOut_1 : 0; 


            const _priceB = web3.utils.toWei(operation.priceB.toString());
            const [ _expectedAmountOut2, _path2, _poolFees2 ] = await this._selectRoutePath(
                                                                        _dexSymbol2,
                                                                        operation.tokenA,
                                                                        operation.tokenB, 
                                                                        _amountIn_2, // if 0,this amountIn is calculated on chain 
                                                                        _priceB,
                                                                        true // second swap
                                                                    );

            console.log( '[_expectedAmountOut2, _path2, _poolFees2 ]', _expectedAmountOut2, _path2, _poolFees2 );

            const _expectedAmountOut_2 = _expectedAmountOut2 !== 0 ? web3.utils.toWei(_expectedAmountOut2.toString()) : 0;

            console.log('swap2: ',[ _dexSymbol2, _dexRouterAddress2, _amountIn_2, _expectedAmountOut_2, _priceB, _path2, _poolFees2 ])

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

    // Price could be A or B
    async _selectRoutePath(_dexSymbol, _tokenA, _tokenB, _amountIn, _price, _isSecondSwap){
        let _expectedAmountOut = 0;
        let _path = [];
        let _poolFees = [];
        // this covers having uniV3 as first swap
        if(_dexSymbol === 'UNIV3'){
            const path = _isSecondSwap ? [_tokenB,_tokenA] : [_tokenA,_tokenB];
            _amountIn = await this._decimalConverter(_amountIn, path);
            console.log('UNIV3 _amountIn: ',_amountIn)

            await this._getUniswapV3Route(path, _amountIn).then(route => {
                _path =  route._routeDataFormated.path;
                _poolFees = route._routeDataFormated.poolFees;
                _expectedAmountOut = route.amountOut;
                console.log('routeUNIV3: ',route)

            });
        } else {
            // not uniV3 and isFirstSwap = true
            // we calculate _expectedOut_1
            if(_amountIn !== 0){
                _amountIn = await this._decimalConverter(_amountIn, _tokenA, _tokenB);
                _price = await this._decimalConverter(_price, _tokenA, _tokenB);
                
                // subtract slippage % of _amountIn
                _amountIn = _amountIn * _price;
                _amountIn = web3.utils.toBN(_amountIn);

                _expectedAmountOut = Number(_amountIn.toString());

                console.log('_inputAmount: ',_expectedAmountOut)
                _expectedAmountOut =  _expectedAmountOut - (_expectedAmountOut * (this.slippage / 10000));
                console.log(`_expectedOutput with slippage of ${this.slippage / 10000}:` , _expectedAmountOut)
            
            // not uniV3 and isFirstSwap = false
            // we calculate _expectedOut_1 on chain
            } else if(_amountIn !== 0){
                _expectedAmountOut = 0;
            }
            // not uni V3 and inverse path if _isSecondSwap =  true
            _path = _isSecondSwap ? [_tokenB, _tokenA] : [_tokenA, _tokenB];
            _poolFees = [0];
        }
        console.log(_dexSymbol,': ',[_expectedAmountOut,_path, _poolFees ])
        return [_expectedAmountOut,_path, _poolFees ];
    }

    async _getUniswapV3Route(path,amountIn){
        return new Promise((resolve, reject) => {
            const route = this.UniswapV3Api.getTokenAPrice(
                this.provider,
                this.chainId, 
                path[0],
                BigNumber.from(amountIn),
                path[1],
                this.slippage
            );
            resolve(route);
        });
    }

    async _decimalConverter(_amountA, path){
        const tokenAInstance = await new ethers.Contract(path[0],IERC20abi.abi, this.provider);
        const tokenBInstance = await new ethers.Contract(path[1],IERC20abi.abi, this.provider);

        const _decimalsA = await tokenAInstance.decimals();
        const _decimalsB = await tokenBInstance.decimals();

        console.log(
            '_decimalsA: ',_decimalsA,
            '_decimalsB: ',_decimalsB,
        )

        if (_decimalsA > _decimalsB) {

            console.log('A>B *',_amountA)
            let decimals = BigNumber.from(10**(_decimalsA - _decimalsB));

            console.log('decimals * : ',decimals.toString())

            _amountA = BigNumber.from(_amountA.toString()).mul(decimals.toString());

            console.log('*: ',_amount.toString())

        } else if (_decimalsB > _decimalsA) {

            console.log('B>A / ',_amountA)
            let decimals = BigNumber.from(10**(_decimalsB - _decimalsA));

            console.log('decimals / : ',decimals.toString())

            _amountA = BigNumber.from(_amountA.toString()).div(decimals.toString());

            console.log('/: ',_amount.toString());

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
 *          {
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
 */

