import { Connection, PublicKey } from '@solana/web3.js';
import { MAINNET_PROGRAM_ID } from '@raydium-io/raydium-sdk';
import { Metaplex, sol } from "@metaplex-foundation/js";
import axios from "axios";

const solanaConnection = new Connection("https://rpc.shyft.to/?api_key=lSeaxDG9Hh48hWcq", { commitment: "confirmed" });
const priceUrl = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

const wrapSolToekn = "So11111111111111111111111111111111111111112";

const metaplex = Metaplex.make(solanaConnection);

const poolAmount: number = 5;

// Sleep function to delay execution
const sleep = async (milliseconds: number) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

// Function to fetch amount_in from the transaction logs
const fetchAmountIn = async (signature: string) => {
    try {
        let resultArr: any = []
        // Fetch the parsed transaction using its signature
        const parsedTransaction = await solanaConnection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });

        if (!parsedTransaction) {
            console.error("Transaction not found");
            return false;
        }

        let proccessingSwapList: any = [];
        let poolSwapList: any = [];
        let tokenIn: string = "";
        let changeIn: number = 0;
        let amountIn: number = 0;
        let tokenOut: string = "";
        let changeOut: number = 0;
        let amountOut: number = 0;

        const accountKeys = parsedTransaction?.transaction.message.accountKeys;
        const signer = accountKeys[0].pubkey.toString();

        const preTokenBalances: any = parsedTransaction.meta?.preTokenBalances;
        const postTokenBalances: any = parsedTransaction.meta?.postTokenBalances;
        let tokenBalanceList: any = [];

        if (preTokenBalances.length == postTokenBalances.length) {
            tokenBalanceList = preTokenBalances;
            for (let i = 0; i < tokenBalanceList!.length; i++) {
                const change = Math.abs(postTokenBalances![i].uiTokenAmount.uiAmount - preTokenBalances![i].uiTokenAmount.uiAmount);
                if (tokenBalanceList![i].owner == signer) {
                    if (change !== 0) {
                        const changeAmount = await getChangingAmount(preTokenBalances![i].mint, change)
                        if (changeAmount < poolAmount) return false;
                        if (changeAmount > poolAmount)
                            proccessingSwapList.push({ preTokenBalance: preTokenBalances![i], postTokenBalance: postTokenBalances![i] })
                    }
                } else {
                    if (change !== 0) {
                        const changeAmount = await getChangingAmount(tokenBalanceList![i].mint, change)
                        if (changeAmount < poolAmount) return false;
                        if (changeAmount > poolAmount)
                            poolSwapList.push({ preTokenBalance: preTokenBalances![i], postTokenBalance: postTokenBalances![i] })
                    }
                }
            }
        } else if (preTokenBalances.length != postTokenBalances.length) {
            tokenBalanceList = postTokenBalances;
            // Get tokenIn and amountIn
            tokenIn = wrapSolToekn;
            for (let i = 0; i < tokenBalanceList.length; i++) {
                if (tokenBalanceList[i].mint === tokenIn) {
                    console.log("post: ", postTokenBalances[i].uiTokenAmount.uiAmount, "pre: ", preTokenBalances[i - 1].uiTokenAmount.uiAmount)
                    amountIn = Math.abs(postTokenBalances[i].uiTokenAmount.uiAmount - preTokenBalances[i - 1].uiTokenAmount.uiAmount);
                    if (amountIn < poolAmount) return false;
                }
            }

            // Get tokenOut and amountOut
            tokenOut = tokenBalanceList[0].mint;
            const change = tokenBalanceList[0].uiTokenAmount.uiAmount;
            amountOut = await getChangingAmount(tokenOut, change);

            resultArr.push({
                buyer: signer,
                tokenIn: tokenIn,
                amountIn: amountIn,
                tokenOut: tokenOut,
                amountOut: amountOut,
                signature: signature
            })

            console.log("🚀 ~ fetchAmountIn ~ resultArr:", resultArr)
            return false;
        }


        if (proccessingSwapList.length === 0 && poolSwapList.length === 0) return false;

        if (proccessingSwapList.length === 2) {
            // Get tokenIn and amountIn
            tokenIn = proccessingSwapList[0].preTokenBalance.mint;
            changeIn = Math.abs(proccessingSwapList[0].postTokenBalance.uiTokenAmount.uiAmount - proccessingSwapList[0].preTokenBalance.uiTokenAmount.uiAmount);
            amountIn = await getChangingAmount(tokenIn, changeIn)

            // Get tokenOut and amountOut
            tokenOut = proccessingSwapList[1].preTokenBalance.mint;
            changeOut = Math.abs(proccessingSwapList[1].postTokenBalance.uiTokenAmount.uiAmount - proccessingSwapList[1].preTokenBalance.uiTokenAmount.uiAmount);
            amountOut = await getChangingAmount(tokenOut, changeOut)
        } else if (proccessingSwapList.length === 1) {
            const change = proccessingSwapList[0].postTokenBalance.uiTokenAmount.uiAmount - proccessingSwapList[0].preTokenBalance.uiTokenAmount.uiAmount;

            if (change < 0) {
                // Get tokenIn and amountIn
                tokenIn = proccessingSwapList[0].preTokenBalance.mint;
                amountIn = await getChangingAmount(tokenIn, change)

                // Get tokenOut and amountOut
                tokenOut = wrapSolToekn;
                for (let i = 0; i < poolSwapList.length; i++) {
                    if (poolSwapList[i].postTokenBalance.mint === tokenOut) {
                        amountOut = Math.abs(poolSwapList[i].postTokenBalance.uiTokenAmount.uiAmount - poolSwapList[i].preTokenBalance.uiTokenAmount.uiAmount);
                    }
                }
            }

            if (change > 0) {
                // Get tokenIn and amountIn
                tokenIn = wrapSolToekn;
                for (let i = 0; i < poolSwapList.length; i++) {
                    if (poolSwapList[i].postTokenBalance.mint === tokenIn) {
                        amountIn = Math.abs(poolSwapList[i].postTokenBalance.uiTokenAmount.uiAmount - poolSwapList[i].preTokenBalance.uiTokenAmount.uiAmount);
                    }
                }

                // Get tokenOut and amountOut
                tokenOut = proccessingSwapList[0].preTokenBalance.mint;
                amountOut = await getChangingAmount(tokenOut, change)
            }
        } else if (proccessingSwapList.length === 0 && poolSwapList.length) {
            console.log("🚀 ~ fetchAmountIn ~ poolSwapList:", poolSwapList)
            tokenIn = poolSwapList[0].preTokenBalance.mint;
            changeIn = Math.abs(poolSwapList[0].postTokenBalance.uiTokenAmount.uiAmount - poolSwapList[0].preTokenBalance.uiTokenAmount.uiAmount);
            amountIn = await getChangingAmount(tokenIn, changeIn)

            // Get tokenOut and amountOut
            tokenOut = poolSwapList[1].preTokenBalance.mint;
            changeOut = Math.abs(poolSwapList[1].postTokenBalance.uiTokenAmount.uiAmount - poolSwapList[1].preTokenBalance.uiTokenAmount.uiAmount);
            amountOut = await getChangingAmount(tokenOut, changeOut)
        }

        resultArr.push({
            buyer: signer,
            tokenIn: tokenIn,
            amountIn: amountIn,
            tokenOut: tokenOut,
            amountOut: amountOut,
            signature: signature
        })

        console.log("🚀 ~ fetchAmountIn ~ resultArr:", resultArr)
        return false;

    } catch (error) {
        console.error("Error fetching:", error);
    }
};

// Get price of token
const getTokenPrice = async (tokenAddr: string) => {
    try {
        const tokenPrice = await axios.get(`https://price.jup.ag/v6/price?ids=${tokenAddr}&vsToken=${wrapSolToekn}`);
        console.log("🚀 ~ getTokenPrice ~ tokenPrice:", tokenPrice)
        return parseFloat(tokenPrice.data.data[tokenAddr].price);
    } catch (error) {
        console.error(`Error fetching token price for ${tokenAddr}:`, error);
        return 0;  // Fallback to zero if price fetch fails
    }
};

// Calculate changing amount
const getChangingAmount = async (mint: string, change: number) => {
    const tokenPrice = await getTokenPrice(mint);
    const changeAmount = Math.abs(change * tokenPrice);
    return changeAmount
}

// Main listener to detect new pools and transactions
const runListener = async () => {
    try {
        // curSolPrice = await getSolPrice();
        let cnt = 0
        let onProcess = false
        solanaConnection.onLogs(
            // Listen for logs related to Raydium AmmV4 (for example)
            MAINNET_PROGRAM_ID.AmmV4,
            async ({ logs, err, signature }) => {
                if (!onProcess) {
                    if (!err) {
                        const isSwapPool = logs.some(log => log.includes("swap"));
                        if (isSwapPool) {
                            onProcess = true
                            cnt++
                            console.log("signature: ", signature, "----------- ", cnt)
                            const result: any = await fetchAmountIn(signature);
                            onProcess = result;
                        }
                    }
                }
            },
            "finalized",
        );
    } catch (error) {
        console.error("Error in runListener:", error);
    }
};

// Run the listener
runListener();
