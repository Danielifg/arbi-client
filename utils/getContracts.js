const ArbiTraderABI = require( '../src/abi/ArbiTrader.json');

const getContract = (abi, address, provider) =>
    new Promise((resolve, reject) => {
        const contractInstance = new ethers.Contract( address , abi , provider );
        if (contractInstance) {
            resolve(contractInstance);
        } else {
            reject('Can\'t get contact');
        }
    });

module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
