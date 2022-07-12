
const { ethers, BigNumber } = require('ethers');
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core')
const JSBI  = require('jsbi'); // jsbi@3.2.5
const IERC20abi = require('../../abi/ERC20.json');

module.exports = class UniswapV3Api {
   constructor(){}
   chooseRouteAndSetPrice(tokenA, tokenB, _routeData) {

      let _routeDataFormated = {
        path: [],
        poolFees: [],
        protocol: null,
      }
      let _amountOut = null;

      if(_routeData && _routeData.route && _routeData.route[0] ){
            let routeChosen = _routeData.route[0];
            _routeDataFormated.protocol = routeChosen.protocol;

        for (var i = 0; i < routeChosen.tokenPath.length; i++) {
            _routeDataFormated.path.push( routeChosen.tokenPath[i].address );
        }

        if(routeChosen.protocol == "V3" ){
          const pools = routeChosen.route.pools;
          for (var i = 0; i < pools.length; i++) {
            _routeDataFormated.poolFees.push(pools[i].fee);
          }
        }
        _amountOut  = routeChosen.rawQuote.toString();
      }

      // if(_routeDataFormated.path.length == 0) _routeDataFormated.path.push("0x0000000000000000000000000000000000000000");

      return [_amountOut, _routeDataFormated];
    }

  
  /**
   * Get amount of token A in terms of token B
   * @param {*} chainId 
   * @param {*} tokenA 
   * @param {*} tokenA_amount 
   * @param {*} tokenB 
   * @param {*} slippage 
   * @returns expected out amount v3 routes and pools fees
   */
   async getTokenAPrice(provider,chainId, tokenA, tokenA_amount, tokenB, slippage) {
      // console.log('v3 provider: ',provider)
      const router = new AlphaRouter({ chainId: chainId, provider: provider});

      const tokenAInstance = await new ethers.Contract(tokenA,IERC20abi.abi, provider);
      const tokenBInstance = await new ethers.Contract(tokenB,IERC20abi.abi, provider);

      const tokenA_symbol = await tokenAInstance.symbol();
      const tokenB_symbol = await tokenBInstance.symbol();

      const tokenA_decimals = await tokenAInstance.decimals();
      const tokenB_decimals = await tokenBInstance.decimals();

      const tokenA_name = await tokenAInstance.name();
      const tokenB_name = await tokenBInstance.name();

      // console.log(
      //   'tokenA_name: ',tokenA_name,
      //   'tokenB_name: ',tokenB_name,
      // )

      const TOKEN_A = new Token( chainId , tokenA , tokenA_decimals, tokenA_symbol, tokenA_name);
      const TOKEN_B = new Token( chainId , tokenB , tokenB_decimals, tokenB_symbol,tokenB_name);
      
      const _amountOutFromRaw= CurrencyAmount.fromRawAmount(TOKEN_A, JSBI.BigInt(tokenA_amount));

      // console.log(
      //   'tokenA_name: ',TOKEN_A,'\n',
      //   'tokenB_name: ',TOKEN_B,'\n',
      //   '_amountOutFromRaw',_amountOutFromRaw
      // )

      const route = await router.route(
        _amountOutFromRaw,
        TOKEN_B,
        TradeType.EXACT_INPUT,
        {
          // 3000/10000 = 0.3
          slippageTolerance: new Percent(slippage, 10000), // 0.5%
        },
        {
          maxSwapsPerPath: 3,
          distributionPercent: 100,
          deadline: Math.floor(Date.now()/1000 + 1800)
        }
      ).then(
        (res) => { return res } ,
        (error) => { console.log('UNIV· API ERROR ::',error) }
      ).catch(error =>{
        console.log('UNIV· API ERROR ::',error) 
      });

      const [ amountOut, _routeDataFormated ] = this.chooseRouteAndSetPrice(tokenA, tokenB, route);
      return {amountOut, _routeDataFormated};
    }
  }