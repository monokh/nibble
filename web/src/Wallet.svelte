<script>
    import { call } from './jsonrpc'

    export let rpc;
    let pubKey;
    let balance;

    let sendPubKey;
    let sendAmount;

    let balancePubKey;
    let pubKeyBalance;

    let randomPubKey;

    function copyPubKey () {
        navigator.clipboard.writeText(pubKey);
    }

    function copyRandomPubKey () {
        navigator.clipboard.writeText(randomPubKey);
    }

    async function send () {
        await call(rpc, 'send', [sendPubKey, sendAmount])
        sendAmount = undefined;
        sendPubKey = undefined;
    }

    async function generateRandomPubKey () {
        randomPubKey = await call(rpc, 'newpubkey', [])
    }

    async function getBalance () {
        pubKeyBalance = await call(rpc, 'getbalance', [balancePubKey])
        console.log(pubKeyBalance)
        balancePubKey = null
    }

    (async function () {
        pubKey = await call(rpc, 'getpubkey', [])
        balance = await call(rpc, 'getbalance', [pubKey])
        generateRandomPubKey()
        setInterval(async () => {
            balance = await call(rpc, 'getbalance', [pubKey])
        }, 5000)
    })()
</script>

<style>
    .wallet {
        padding: 0 20px 20px 20px;
        border: 1px solid #b9b9b9;
    }

    .grid {
        display: grid;
        grid-template-rows: auto auto;
        grid-template-columns: auto 1fr;
        grid-gap: 10px;
        align-items: center;
    }
</style>

<div class="wallet">
    <h2>Wallet</h2>
    <div class="grid">
        <div>Balance:</div><div>{#await balance then balance}<strong>{balance} Nibble </strong>{/await}</div>
        <div>Public Key:</div><div>{#await pubKey then pubKey}<input type="text" style="width: 170px;" value={pubKey} />{/await} <button on:click={copyPubKey}>Copy</button></div>
    </div>
    <hr />
    <h2>Send</h2>
    <div class="grid">
        <div>To: </div><div><input type="text" placeholder="Receiver pubkey" bind:value={sendPubKey} /></div>
        <div>Amount:</div><div><input type="number" placeholder="Enter amount to send" bind:value={sendAmount} /> <button on:click={send}>Send</button></div>
    </div>
    <hr />
    <h2>Random Public Key</h2>
    <div>{#await randomPubKey then randomPubKey}<input type="text" style="width: 170px;" value={randomPubKey} />{/await} <button on:click={copyRandomPubKey}>Copy</button> <button on:click={generateRandomPubKey}>New</button></div>
    <hr />
    <h2>Get Balance</h2>
    <div class="grid">
        <div>Public Key:</div><div><input type="text" placeholder="pubkey" bind:value={balancePubKey} /> <button on:click={getBalance}>Go</button></div>
        <strong>{#if !isNaN(pubKeyBalance)}{pubKeyBalance} Nibble{/if}</strong>
    </div>
</div>