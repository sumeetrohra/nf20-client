import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { erc721abi } from "./contracts/erc721";
import {
  fractionalizerAddress,
  fractionalizerAbi,
} from "./contracts/fractionalizer";

const App = () => {
  const [address, setAddress] = useState("");
  const [networkId, setNetworkId] = useState();

  const [nftCollection, setNftCollection] = useState("");
  const [nftTokenId, setNftTokenId] = useState(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");

  const [loading, setLoading] = useState(false);

  const [nftHoldings, setNftHoldings] = useState([]);

  const provider = new ethers.providers.Web3Provider(window.ethereum);

  const handleSigner = async () => {
    setLoading(true);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const network = await signer.getChainId();
    setAddress(address);
    setNetworkId(network);
    setLoading(false);
  };

  const handleConnectWallet = async () => {
    if (!provider) return;
    await provider.send("eth_requestAccounts", []);
    handleSigner();
  };

  useEffect(() => {
    handleSigner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBalances = async () => {
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const fractionalizerContract = new ethers.Contract(
      fractionalizerAddress,
      fractionalizerAbi,
      provider
    );
    const balances = await fractionalizerContract.userBalances(address);
    const nfts = await Promise.all(
      Array.from({ length: balances.length }, async (bal, idx) => {
        const data = await fractionalizerContract.erc20ToNFT(idx);
        const balance =
          balances[idx].div("1000000000000000000") +
          "." +
          balances[idx].mod("1000000000000000000");
        const percentHolding = Number(balance) / 1000;
        return {
          erc20Name: data.erc20Name,
          erc20Symbol: data.erc20Symbol,
          isRedeemed: data.isRedeemed,
          nftCollection: data.nftCollection,
          nftTokenId: data.nftTokenId.toString(),
          userBalance: balance,
          userPercentageHolding: percentHolding,
          erc20TokenId: idx,
        };
      })
    );
    setNftHoldings(nfts);
  };

  useEffect(() => {
    handleBalances();
  }, [loading]);

  const handleFractionalize = async () => {
    if (!nftCollection || !nftTokenId || !name || !symbol) return;
    setLoading(true);
    const nftContract = new ethers.Contract(nftCollection, erc721abi, provider);
    const fractionalizerContract = new ethers.Contract(
      fractionalizerAddress,
      fractionalizerAbi,
      provider
    );
    try {
      const signer = provider.getSigner();
      const approveTx = await nftContract
        .connect(signer)
        .approve(fractionalizerAddress, nftTokenId);
      await approveTx.wait();
      const tx = await fractionalizerContract
        .connect(signer)
        .fractionalize(nftCollection, nftTokenId, name, symbol);
      await tx.wait();
      handleBalances();
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (tokenId) => {
    console.log(tokenId);
    const nftData = nftHoldings.filter(
      (nft) => nft.erc20TokenId === tokenId
    )[0];
    if (nftData.userPercentageHolding !== 100) return;
    console.log(nftData);
    try {
      setLoading(true);
      const fractionalizerContract = new ethers.Contract(
        fractionalizerAddress,
        fractionalizerAbi,
        provider
      );
      const signer = provider.getSigner();
      const tx = await fractionalizerContract.connect(signer).redeem(tokenId);
      console.log("@@@", tx);
      const rec = await tx.wait();
      console.log("@@@####", rec);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {address && networkId ? (
        <div>
          address: {address}, chainId: {networkId}
        </div>
      ) : (
        <button onClick={handleConnectWallet}>Connect wallet</button>
      )}
      <hr />
      <input
        placeholder="nft collection address"
        value={nftCollection}
        onChange={(e) => setNftCollection(e.target.value)}
      />
      <input
        placeholder="NFT Token ID"
        value={nftTokenId}
        onChange={(e) => setNftTokenId(e.target.value)}
      />
      <input
        placeholder="ERC 20 Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="ERC 20 Symbol"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
      />
      <button
        onClick={handleFractionalize}
        disabled={!nftCollection || !nftTokenId || !name || !symbol}
      >
        Fractionalize NFT
      </button>
      {loading && <p>Loading...</p>}
      <ol>
        {nftHoldings.map((nft) => (
          <li>
            <p>ERC 20 Name: {nft.erc20Name}</p>
            <p>ERC 20 Symbol: {nft.erc20Symbol}</p>
            <p>NFT collection: {nft.nftCollection}</p>
            <p>NFT Token ID: {nft.nftTokenId}</p>
            <p>ERC 20 Tokens: {nft.userBalance}</p>
            <p>ERC 20 Percentage Holding: {nft.userPercentageHolding + "%"}</p>
            {nft.userPercentageHolding === 100 && (
              <button onClick={() => handleRedeem(nft.erc20TokenId)}>
                Redeem
              </button>
            )}
            <hr />
          </li>
        ))}
      </ol>
    </div>
  );
};

export default App;
