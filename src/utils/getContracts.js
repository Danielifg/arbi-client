const ethers = require('ethers');
const ArbiTraderABI = require( '../abi/ArbiTrader.json');
const ArbiTraderAddress = "0x5C9dEE2b0b03e7b035eBfE6a608696644d11eA1f"; // polygon

const getContract = (abi, address, provider) =>
    new Promise((resolve, reject) => {
        const contractInstance = new ethers.Contract( address , abi , provider );
        if (contractInstance) {
            resolve(contractInstance);
        } else {
            reject('Can\'t get contact');
        }01
    });

module.exports.getTraderContract = (provider,address) => getContract(ArbiTraderABI.abi, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
// module.exports.getDistributorsContract = (address, provider) => getContract(ArbiTraderABI, address, provider);
