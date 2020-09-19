<script>
    import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
    import { call } from './jsonrpc'

    export let rpc;
    let mempool = [];
    let blocks = [];
    let selectedBlockNumber;
    let selectedBlock;

    async function updateData () {
        mempool = await call(rpc, 'mempool', []);
        const latest_block = await call(rpc, 'blockheight', [])
        const current_block = blocks[blocks.length - 1]
        if (latest_block === current_block) return;
        if (blocks.length) {
            const block_difference = latest_block - current_block;
            const newBlocks = [];
            for (let i = 0; i < block_difference; i++) {
                const block = current_block + i + 1;
                newBlocks.push(block);
            }
            blocks = [...blocks, ...newBlocks]
        } else {
            blocks = [latest_block]
        }
    }

    async function selectBlock (block) {
        selectedBlockNumber = block
        selectedBlock = await call(rpc, 'getblock', [block])
    }

    (async function () {
        await updateData()
        setInterval(async () => {
            await updateData()
        }, 5000)
    })();
</script>

<style>
    .explorer {
        padding: 0 20px 20px 20px;
        margin-left: 20px;
        border: 1px solid #b9b9b9;
    }

    .table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
    }

    .table thead, .table tr {
        border-bottom: 1px solid #9e9e9e;
    }

    .table td {
        padding-top: 10px;
        padding-right: 10px;
    }
    
    .table thead {
        font-weight: bold;
    }

    .table thead td:nth-child(3) {
        width: 100px;
    }

    .table td {
        padding-bottom: 10px;
    }

    .table tr td {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .table tr td:hover {
        overflow: show;
        text-overflow: initial;
        overflow-wrap: break-word;
    }

    .blocks {
        display: flex;
        flex-direction: row;
    }

    .block-list {
        align-items: center;
        height: 400px;
        overflow-y: scroll;
        padding-right: 10px;
    }

    .block-list button {
        display: block;
        width: 100px;
        padding: 10px 10px 8px;
        margin-bottom: 10px;
    }

    .block-detail {
        flex: 1;
        padding-left: 20px;
    }

</style>

<div class="explorer">
    <h2>Mempool</h2>
    <div>
        {#if mempool.length}
        <table class="table">
            <thead>
                <td>From</td>
                <td>To</td>
                <td>Value</td>
            </thead>
            {#each mempool as item}
                <tr>
                    <td>{item.transaction.from}</td>
                    <td>{item.transaction.to}</td>
                    <td>{item.transaction.amount}</td>
                </tr>
            {/each}
        </table>
        {:else}
        Empty
        {/if}
    </div>
    <hr />
    <h2>Blocks</h2>
    <div class="blocks">
        <div class="block-list">
            {#each blocks.slice().reverse() as block (block)}
            <button on:click={selectBlock(block)} 
                class="{block === selectedBlockNumber ? 'selected' : ''}"
                animate:flip in:fade={{delay:500, duration: 1000}} out:fly={{x:100}}>
                No. {block}
            </button>
            {/each}
        </div>
        {#if selectedBlock}
        <div class="block-detail">
            <p>{selectedBlock.hash}</p>
            <table class="txs table">
                <thead>
                    <td>From</td>
                    <td>To</td>
                    <td>Value</td>
                </thead>
                {#each selectedBlock.transactions as item}
                    <tr>
                        <td>{item.transaction.from}</td>
                        <td>{item.transaction.to}</td>
                        <td>{item.transaction.amount}</td>
                    </tr>
                {/each}
                </table>
        </div>
        {/if}
    </div>
</div>