
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

    async deposit(_depositAmount){
        let amountInEther = ethers.utils.formatEther(_depositAmount.toString());
        let tx = { 
          to: ArbitrageContract.address,
          value: ethers.utils.parseEther(amountInEther)
        };
    
        await wallet.sendTransaction(tx)
        .then((txObj) => {console.log('txHash', txObj.hash)})
        .catch(err => console.log(err));
      
        const traderBalance = await provider.getBalance(ArbitrageContract.address);
        console.log('traderBalance: ',traderBalance.toString());
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

            console.log('priceA: ',_priceA,_dexSymbol);
            const [ _expectedAmountOut,_path, _poolFees ] = await this._selectRoutePath(
                                                                        _dexSymbol,
                                                                        operation.tokenA, operation.tokenB,
                                                                        _loanAmount,
                                                                        _priceA
                                                                        );

            console.log('log: ',
                [ _dexSymbol, _dexRouterAddress, _loanAmount, _expectedAmountOut,
                    _priceA, _path, _poolFees ]
            )
            const operation_1 = abiCoder.encode(
                    [ 'string', 'address', 'uint256','uint256','uint256','address[]','uint24[]'],
                    [ _dexSymbol, _dexRouterAddress, _loanAmount, BigNumber.from(_expectedAmountOut.toString()),
                        _priceA, _path, _poolFees ]
            );

            // operation_2
            let [ _dexSymbol2, _dexRouterAddress2 ] = await this._selectRouterDetails(operation.dexSymbol.dexB);
            const _priceB = web3.utils.toWei(operation.priceB.toString());
            console.log('priceB: ',_priceB,_dexSymbol2, _dexRouterAddress2);

            const [ _expectedAmountOut2, _path2, _poolFees2 ] = await this._selectRoutePath(
                                                                        _dexSymbol2,
                                                                        operation.tokenA,
                                                                        operation.tokenB, 
                                                                        0, // amount in calculated on chain 
                                                                        _priceB
                                                                    );  

            const operation_2 = abiCoder.encode(
                [  'string', 'address', 'uint256','uint256','uint256','address[]','uint24[]'],
                [ _dexSymbol2, _dexRouterAddress2, 0, 0, _priceB, _path2, _poolFees2 ]
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
    async _selectRoutePath(_dexSymbol, _tokenA, _tokenB, _amountIn, _price){
        let _expectedAmountOut = 0;
        let _path = [];
        let _poolFees = [];

        if(_dexSymbol === 'UNIV3'){
            const route = await this._getUniswapV3Route(_tokenA, _tokenB, _amountIn).then(route => {
                _path =  route._routeDataFormated.path;
                _poolFees = route._routeDataFormated.poolFees;
            });
        } else {
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
            
            } else {
                _expectedAmountOut = 0;
             }
            _path = [_tokenA, _tokenB];
            _poolFees = [0];
        }
        return [_expectedAmountOut,_path, _poolFees ];
    }

    async _getUniswapV3Route(tokenA,tokenB,amountIn){
        return new Promise((resolve, reject) => {
            const route = this.UniswapV3Api.getTokenAPrice(
                this.provider,
                this.chainId, 
                tokenA,
                BigNumber.from(amountIn),
                tokenB,
                this.slippage
            );
            resolve(route);
        });
    }

    async _decimalConverter(_amountA, _tokenA, _tokenB){
        const tokenAInstance = await new ethers.Contract(_tokenA,IERC20abi.abi, this.provider);
        const tokenBInstance = await new ethers.Contract(_tokenB,IERC20abi.abi, this.provider);

        const _decimalsA = await tokenAInstance.decimals();
        const _decimalsB = await tokenBInstance.decimals();
        let _amount = 0;

        if (_decimalsA > _decimalsB) {
            _amount = _amountA * (10**(_decimalsA - _decimalsB));
        } else if (_decimalsB > _decimalsA) {
            _amount = _amountA / (10**(_decimalsB - _decimalsA));
        }
        return _amount;
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

