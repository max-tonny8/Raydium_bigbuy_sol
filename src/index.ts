import express, { Request, Response } from 'express';
import {
    LAMPORTS_PER_SOL,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    Keypair,
    PublicKey,
    Connection,
} from "@solana/web3.js";
import {
    MINT_SIZE,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMint2Instruction,
    getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const privateKeyBase58 = process.env.PRIVATE_KEY;
const devRpcUrl = process.env.DEV_RPC;
// const mintPrivateKeyBase58 = process.env.MINT_PRIVATE_KEY;

if (!privateKeyBase58) {
    throw new Error("Environment variable PRIVATE_KEY is not set");
}

if (!devRpcUrl) {
    throw new Error("Environment variable DEV_RPC is not set");
}

// if (!mintPrivateKeyBase58) {
//     throw new Error("Environment variable MINT_PRIVATE_KEY is not set");
// }

// Decode the private key and create a Keypair
const keypair = Keypair.fromSecretKey(bs58.default.decode(privateKeyBase58));
// const mintKeypair = Keypair.fromSecretKey(bs58.default.decode(mintPrivateKeyBase58));

const sender = new PublicKey("83Vmz5tUqEw4j9ijJML2FkYJbG26mAiQ38NGrShAXHn9");
const receiver = new PublicKey("5kRkC4SRLQV95FJ5mQF2XJzBGjG1CUYpVeAUZJsm4t5t");
const connection = new Connection(devRpcUrl);

const app = express();
const port = 3000;

app.get("/", async (req: any, res: any) => {
    res.send("Backend Server is Running now!");
});

app.get('/transfer', async (req: Request, res: Response) => {
    try {
        // Create transfer instruction
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: sender,
            toPubkey: receiver,
            lamports: 0.01 * LAMPORTS_PER_SOL,  // Transfer 0.01 SOL
        });

        // Create transaction and add the transfer instruction
        const transaction = new Transaction().add(transferInstruction);

        // Send and confirm the transaction
        const transactionSignature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair]
        );

        console.log(
            "Transaction Signature:",
            `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`
        );
        res.send('Success!');
    } catch (error) {
        console.error("Error occurred during the transaction:", error);
    }
});

app.get('/createToken', async (req: Request, res: Response) => {
    const wallet = sender;
    const mint = new Keypair();

    try {
        // Calculate minimum lamports for space required by mint account
        const rentLamports = await getMinimumBalanceForRentExemptMint(connection);

        // Instruction to create new account with space for new mint account
        const createAccountInstruction = SystemProgram.createAccount({
            fromPubkey: wallet,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports: rentLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        });

        // Instruction to initialize mint account
        const initializeMintInstruction = createInitializeMint2Instruction(
            mint.publicKey,
            2, // decimals
            wallet, // mint authority
            wallet, // freeze authority
            TOKEN_2022_PROGRAM_ID,
        );

        // Build transaction with instructions to create new account and initialize mint account
        const transaction = new Transaction().add(
            createAccountInstruction,
            initializeMintInstruction,
        );

        const transactionSignature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [
                keypair, // payer
                mint, // mint address keypair
            ],
        );

        console.log(
            "\nTransaction Signature:",
            `https://solana.fm/tx/${transactionSignature}?cluster=devnet-solana`,
        );

        console.log(
            "\nMint Account:",
            `https://solana.fm/address/${mint.publicKey}?cluster=devnet-solana`,
        );
        res.send('Success!');
    } catch (error) {
        console.error("Error occurred during the transaction:", error);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
