const fs = require('fs');
const path = require('path');
const { contract, config } = require('@nomiclabs/buidler');
const { wrap } = require('../../index.js');
const { web3 } = require('@nomiclabs/buidler');
const { assert } = require('../contracts/common');
const { toUnit } = require('../utils')();
const {
	detectNetworkName,
	connectContracts,
	ensureAccountHasEther,
	ensureAccountHassUSD,
	skipWaitingPeriod,
	simulateExchangeRates,
	takeDebtSnapshot,
	mockOptimismBridge,
} = require('./utils');

contract('EtherCollateral (prod tests)', accounts => {
	const [, user1] = accounts;

	let owner;

	let network, deploymentPath;

	let EtherCollateral, ReadProxyAddressResolver, Depot;
	let HassethBNB, HassethUSD;

	before('prepare', async function() {
		network = await detectNetworkName();
		const { getUsers, getPathToNetwork } = wrap({ network, fs, path });

		owner = getUsers({ network, user: 'owner' }).address;

		deploymentPath = config.deploymentPath || getPathToNetwork(network);

		if (config.useOvm) {
			return this.skip();
		}

		console.log(config);
		if (config.patchFreshDeployment) {
			await simulateExchangeRates({ network, deploymentPath });
			await takeDebtSnapshot({ network, deploymentPath });
			await mockOptimismBridge({ network, deploymentPath });
		}

		({
			EtherCollateral,
			HassethBNB,
			HassethUSD,
			ReadProxyAddressResolver,
			Depot,
		} = await connectContracts({
			network,
			requests: [
				{ contractName: 'EtherCollateral' },
				{ contractName: 'Depot' },
				{ contractName: 'ReadProxyAddressResolver' },
				{ contractName: 'HassethBNB', abiName: 'Synth' },
				{ contractName: 'HassethUSD', abiName: 'Synth' },
			],
		}));

		await skipWaitingPeriod({ network });

		await ensureAccountHasEther({
			amount: toUnit('1'),
			account: owner,
			fromAccount: accounts[7],
			network,
		});
		await ensureAccountHassUSD({
			amount: toUnit('1000'),
			account: user1,
			fromAccount: owner,
			network,
		});
	});

	describe('misc state', () => {
		it('has the expected resolver set', async () => {
			assert.equal(await EtherCollateral.resolver(), ReadProxyAddressResolver.address);
		});

		it('has the expected owner set', async () => {
			assert.equal(await EtherCollateral.owner(), owner);
		});
	});

	describe('opening a loan', () => {
		const amount = toUnit('5');

		let ethBalance, sEthBalance;
		let tx;
		let loanID;

		before(async () => {
			ethBalance = await web3.eth.getBalance(user1);
			sEthBalance = await HassethBNB.balanceOf(user1);

			tx = await EtherCollateral.openLoan({
				from: user1,
				value: amount,
			});
		});

		it('produces a valid loan id', async () => {
			({ loanID } = tx.receipt.logs.find(log => log.event === 'LoanCreated').args);

			assert.notEqual(loanID.toString(), '0');
		});

		describe('closing a loan', () => {
			before(async () => {
				if (network === 'local') {
					const amount = toUnit('100');

					const balance = await HassethUSD.balanceOf(Depot.address);
					if (balance.lt(amount)) {
						await HassethUSD.approve(Depot.address, amount, {
							from: user1,
						});

						await Depot.depositSynths(amount, {
							from: user1,
						});
					}
				}

				ethBalance = await web3.eth.getBalance(user1);
				sEthBalance = await HassethBNB.balanceOf(user1);

				await EtherCollateral.closeLoan(loanID, {
					from: user1,
				});
			});

			it('reimburses BNB', async () => {
				assert.bnGt(web3.utils.toBN(await web3.eth.getBalance(user1)), web3.utils.toBN(ethBalance));
			});

			it('deducts hBNB', async () => {
				assert.bnLt(await HassethBNB.balanceOf(user1), sEthBalance);
			});
		});
	});
});
