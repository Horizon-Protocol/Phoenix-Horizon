const fs = require('fs');
const path = require('path');
const { connectContract } = require('./connectContract');
const { web3 } = require('@nomiclabs/buidler');
const { toBN } = web3.utils;
const { wrap, toBytes32 } = require('../../..');

async function getOwner({ network, deploymentPath }) {
	const { getUsers } = wrap({ network, fs, path });

	return getUsers({ network, deploymentPath, user: 'owner' }).address;
}

async function ensureAccountHasEther({ network, deploymentPath, amount, account }) {
	const fromAccount = await getOwner({ network, deploymentPath });

	const balance = toBN(await web3.eth.getBalance(fromAccount));
	if (balance.lt(amount)) {
		throw new Error(
			`Account ${fromAccount} only has ${balance} BNB and cannot transfer ${amount} BNB to ${account} `
		);
	}

	await web3.eth.sendTransaction({
		from: fromAccount,
		to: account,
		value: amount,
	});
}

async function ensureAccountHasSNX({ network, deploymentPath, amount, account }) {
	const fromAccount = await getOwner({ network, deploymentPath });

	const SNX = await connectContract({ network, deploymentPath, contractName: 'ProxyERC20' });

	const balance = toBN(await SNX.balanceOf(fromAccount));
	if (balance.lt(amount)) {
		throw new Error(
			`Account ${fromAccount} only has ${balance} SNX and cannot transfer ${amount} SNX to ${account} `
		);
	}

	await SNX.transfer(account, amount, {
		from: fromAccount,
	});
}

async function ensureAccountHassUSD({ network, deploymentPath, amount, account }) {
	const fromAccount = await getOwner({ network, deploymentPath });

	const sUSD = await connectContract({
		network,
		deploymentPath,
		contractName: 'SynthhUSD',
		abiName: 'Synth',
	});

	const balance = toBN(await sUSD.transferableSynths(fromAccount));
	if (balance.lt(amount)) {
		const snxToTransfer = amount.mul(toBN('50'));
		await ensureAccountHasSNX({
			network,
			deploymentPath,
			account,
			amount: snxToTransfer,
		});

		const Synthetix = await connectContract({
			network,
			deploymentPath,
			contractName: 'ProxyERC20',
			abiName: 'Synthetix',
		});

		await Synthetix.issueSynths(amount, {
			from: account,
		});
	} else {
		await sUSD.transferAndSettle(account, amount, { from: fromAccount });
	}
}

async function ensureAccountHassETH({ network, deploymentPath, amount, account }) {
	const sUSDAmount = amount.mul(toBN('10'));
	await ensureAccountHassUSD({ network, deploymentPath, amount: sUSDAmount, account });

	const Synthetix = await connectContract({
		network,
		deploymentPath,
		contractName: 'ProxyERC20',
		abiName: 'Synthetix',
	});

	await Synthetix.exchange(toBytes32('hUSD'), sUSDAmount, toBytes32('hBNB'), {
		from: account,
	});
}

module.exports = {
	ensureAccountHasEther,
	ensureAccountHassUSD,
	ensureAccountHassETH,
	ensureAccountHasSNX,
};
