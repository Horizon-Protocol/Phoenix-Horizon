'use strict';

const Web3 = require('web3');
const axios = require('axios');
const { gray, yellow, red, cyan } = require('chalk');

const { loadConnections } = require('./util');
const { toBytes32 } = require('../../.');

module.exports = async ({ network, providerUrl, synths, oldExrates, standaloneFeeds }) => {
	const output = [];
	const { etherscanUrl } = loadConnections({ network });

	const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));

	const feeds = standaloneFeeds.concat(synths);

	let abi = [
		{
			inputs: [
				{ internalType: 'address', name: '_owner', type: 'address' },
				{ internalType: 'uint256', name: '_decimals', type: 'uint256' },
				{ internalType: 'uint256', name: '_windowSize', type: 'uint256' },
				{ internalType: 'address', name: '_operator', type: 'address' },
				{ internalType: 'address', name: '_pancakeV2', type: 'address' },
				{ internalType: 'address[]', name: '_path', type: 'address[]' },
				{ internalType: 'uint256', name: '_amountIn', type: 'uint256' },
			],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'constructor',
		},
		{
			anonymous: false,
			inputs: [
				{ indexed: true, internalType: 'uint256', name: 'answer', type: 'uint256' },
				{ indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
			],
			name: 'AnswerUpdated',
			type: 'event',
		},
		{
			anonymous: false,
			inputs: [
				{ indexed: true, internalType: 'int256', name: 'current', type: 'int256' },
				{ indexed: true, internalType: 'uint256', name: 'roundId', type: 'uint256' },
				{ indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
			],
			name: 'AnswerUpdated',
			type: 'event',
		},
		{
			anonymous: false,
			inputs: [
				{ indexed: true, internalType: 'uint256', name: 'roundId', type: 'uint256' },
				{ indexed: true, internalType: 'address', name: 'startedBy', type: 'address' },
				{ indexed: false, internalType: 'uint256', name: 'startedAt', type: 'uint256' },
			],
			name: 'NewRound',
			type: 'event',
		},
		{
			constant: true,
			inputs: [],
			name: 'decimals',
			outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'description',
			outputs: [{ internalType: 'string', name: '', type: 'string' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			name: 'entries',
			outputs: [
				{ internalType: 'uint256', name: 'roundID', type: 'uint256' },
				{ internalType: 'uint256', name: 'answer', type: 'uint256' },
				{ internalType: 'uint256', name: 'originAnswer', type: 'uint256' },
				{ internalType: 'uint256', name: 'startedAt', type: 'uint256' },
				{ internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
				{ internalType: 'uint256', name: 'answeredInRound', type: 'uint256' },
				{ internalType: 'uint256', name: 'priceCumulative', type: 'uint256' },
			],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [{ internalType: 'uint256', name: '_roundId', type: 'uint256' }],
			name: 'getAnswer',
			outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [{ internalType: 'uint80', name: '_roundId', type: 'uint80' }],
			name: 'getRoundData',
			outputs: [
				{ internalType: 'uint80', name: '', type: 'uint80' },
				{ internalType: 'int256', name: '', type: 'int256' },
				{ internalType: 'uint256', name: '', type: 'uint256' },
				{ internalType: 'uint256', name: '', type: 'uint256' },
				{ internalType: 'uint80', name: '', type: 'uint80' },
			],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [{ internalType: 'uint256', name: '_roundId', type: 'uint256' }],
			name: 'getTimestamp',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'keyDecimals',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'latestAnswer',
			outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'latestRound',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'latestRoundData',
			outputs: [
				{ internalType: 'uint80', name: '', type: 'uint80' },
				{ internalType: 'int256', name: '', type: 'int256' },
				{ internalType: 'uint256', name: '', type: 'uint256' },
				{ internalType: 'uint256', name: '', type: 'uint256' },
				{ internalType: 'uint80', name: '', type: 'uint80' },
			],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'latestTimestamp',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'roundID',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: false,
			inputs: [
				{ internalType: 'uint256', name: '_amountIn', type: 'uint256' },
				{ internalType: 'address[]', name: '_path', type: 'address[]' },
			],
			name: 'setAmountsOut',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: false,
			inputs: [{ internalType: 'uint256', name: '_decimals', type: 'uint256' }],
			name: 'setDecimals',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: false,
			inputs: [{ internalType: 'uint256', name: 'answer', type: 'uint256' }],
			name: 'setLatestAnswer',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: false,
			inputs: [{ internalType: 'address', name: '_pancakeV2', type: 'address' }],
			name: 'setPancakeRouterV2Addr',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: false,
			inputs: [{ internalType: 'uint256', name: '_windowSize', type: 'uint256' }],
			name: 'setWindowSize',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: false,
			inputs: [],
			name: 'updateLatestAnswer',
			outputs: [],
			payable: false,
			stateMutability: 'nonpayable',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'version',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
		{
			constant: true,
			inputs: [],
			name: 'windowSize',
			outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
			payable: false,
			stateMutability: 'view',
			type: 'function',
		},
	];

	for (const { name, asset, feed, inverted } of feeds) {
		const currencyKey = name || asset; // either name of synth or asset for standalone
		if (feed) {
			if (!web3.utils.isAddress(feed)) {
				throw Error(
					`Invalid aggregator address for ${currencyKey}: ${feed}. (If mixed case, make sure it is valid checksum)`
				);
			}

			if (!abi) {
				console.log('feed', feed);
				// Get the ABI from the first aggregator on Etherscan
				// Note: assumes all use the same ABI
				const {
					data: { result },
				} = await axios.get(etherscanUrl, {
					params: {
						module: 'contract',
						action: 'getabi',
						address: feed,
						apikey: process.env.ETHERSCAN_KEY,
					},
				});
				abi = JSON.parse(result);
			}

			const liveAggregator = new web3.eth.Contract(abi, feed);

			const [
				aggAnswerRaw,
				exRatesAnswerRaw,
				{ frozenAtUpperLimit, frozenAtLowerLimit },
			] = await Promise.all([
				liveAggregator.methods.latestAnswer().call(),
				oldExrates.methods.rateForCurrency(toBytes32(currencyKey)).call(),
				oldExrates.methods.inversePricing(toBytes32(currencyKey)).call(),
			]);

			let answer = (aggAnswerRaw / 1e8).toString();

			// do a quick calculation of he inverted number
			if (inverted) {
				answer = 2 * inverted.entryPoint - answer;
				answer = frozenAtLowerLimit ? inverted.lowerLimit : Math.max(answer, inverted.lowerLimit);
				answer = frozenAtUpperLimit ? inverted.upperLimit : Math.min(answer, inverted.upperLimit);
			}

			const existing = web3.utils.fromWei(exRatesAnswerRaw);

			if (answer === existing) {
				output.push(
					gray(
						`- ${
							name ? 'Synth ' : ''
						}${currencyKey} aggregated price: ${answer} (same as currently on-chain)`
					)
				);
			} else {
				const diff = ((Math.abs(answer - existing) / answer) * 100).toFixed(2);

				const colorize = diff > 5 ? red : diff > 1 ? yellow : cyan;
				output.push(
					colorize(
						`- ${
							name ? 'Synth ' : ''
						}${currencyKey} aggregated price: ${answer} vs ${existing} (${diff} %)`
					)
				);
			}
		}
	}

	return output;
};
