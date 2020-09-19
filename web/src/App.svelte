<script>
	import Wallet from './Wallet.svelte';
	import Explorer from './Explorer.svelte';

	let rpc = 'http://localhost:1337';
</script>

<style>
.container {
	width: 1100px;
	margin: 0 auto;
	display: grid;
	grid-template-columns: 33% 67%;
	grid-template-rows: auto auto auto;
	grid-template-areas:
        "header rpc"
        "wallet explorer";
}

h1 {
	color: #000000;
	grid-area: header;
}

.rpc {
	grid-area: rpc;
	text-align: right;
	align-self: center;
}
</style>

<div class="container">
	<h1>NIBBLE</h1>
	<div class="rpc">
		Node: <input name="rpc" type="text" bind:value={rpc} placeholder="Node address" />
	</div>
	<Wallet bind:rpc={rpc} />
	<Explorer bind:rpc={rpc} />
</div>
