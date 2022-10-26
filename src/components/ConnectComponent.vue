<script setup lang="ts">
import { computed, onMounted, nextTick, ref } from "vue";
import type { ChainOption } from "@/types";
import type { PropType } from "vue";
import WalletConnectProvider from "@walletconnect/web3-provider";
import FuseNetworkWalletConnectProvider from "fuse-walletconnect-web3-provider";
import Connector from "./Connector.vue";
import { CHAIN_ID, CHAIN_INFO, availableConnectors } from "@/constants/index";

const props = defineProps({
  chain: {
    type: Number,
    default: CHAIN_ID.FANTOM_OPERA,
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
  cachedConnector: {
    type: String,
    default: "",
  },
  metamaskMobileDappLink: {
    type: String,
    default: "",
  },
  chainData: {
    type: Object as PropType<ChainOption>,
    default: undefined,
  },
});

const emit = defineEmits([
  "update:modelValue",
  "startLoading",
  "endLoading",
  "response",
  "error",
]);

const loading = ref(false);

const windowObj = ref(window);

const isMobile = computed(() =>
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
);
const showModal = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit("update:modelValue", val);
  },
});
const availableConns = computed(() => {
  return availableConnectors.map((el) => {
    if (el.type === "metamask-mobile") {
      return {
        ...el,
        href: props.metamaskMobileDappLink,
      };
    }
    return el;
  });
});

const toConnectChainInfo = computed(() => {
  if (props.chainData) {
    return props.chainData;
  }
  return CHAIN_INFO[props.chain];
});

const toHex = (chainIdDec: number) => `0x${chainIdDec.toString(16)}`;
const addEthereumChain = async (option: ChainOption) => {
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: toHex(props.chain),
        chainName: option.name,
        nativeCurrency: {
          ...option.nativeCurrency,
        },
        rpcUrls: [option.rpcUrl],
        blockExplorerUrls: [option.explorer],
      },
    ],
  });
};

const connectToCorrectChainMetamask = async (
  option: ChainOption,
  chain?: number
) => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHex(chain || props.chain) }],
    });
  } catch (error) {
    console.debug({ error });
    // eslint-disable-next-line
    if ((error as any).code === 4902) {
      // Error switch chain
      await addEthereumChain(option);
    } else {
      throw error;
    }
  }
};

const connectMetamask = async (chain: number) => {
  const chainInfo = toConnectChainInfo.value;

  if (!window.ethereum) {
    throw new Error("No provider was found");
  }
  const provider = window.ethereum;
  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  if (chainId !== chain) {
    await connectToCorrectChainMetamask(chainInfo, chain);
  }
  const [address] = await window.ethereum //
    .request({ method: "eth_requestAccounts" });

  return {
    account: address,
    provider,
    chainId: chain,
  };
};

const connectWalletConnect = async (chain: number) => {
  const rpcUrl = toConnectChainInfo.value.rpcUrl;
  const provider = [CHAIN_ID.FUSE_MAINNET, CHAIN_ID.FUSE_TESTNET].includes(
    chain
  )
    ? new FuseNetworkWalletConnectProvider({
        rpc: {
          [chain]: rpcUrl,
        },
        qrcode: true,
      })
    : new WalletConnectProvider({
        rpc: {
          [chain]: rpcUrl,
        },
        qrcode: true,
        pollingInterval: 15000,
      });
  // ensure that the uri is going to be available, and emit an event if there's a new uri
  if (!provider.wc.connected) {
    await provider.wc.createSession({ chainId: chain });
  }
  // eslint-disable-next-line
  return new Promise(async (resolve, reject) => {
    // connection refused in wallet
    try {
      const accounts = await provider.enable();

      const chainId = Number(await provider.request({ method: "eth_chainId" }));
      if (chainId !== chain) {
        reject("Unsupported chain");
      }

      resolve({
        provider,
        chainId,
        account: accounts[0],
      });
    } catch (error) {
      reject(error);
    }
  });
};

const connectToWallet = async (id: string) => {
  if (loading.value) return;
  try {
    loading.value = true;
    emit("startLoading");
    const connectors = {
      metamask: connectMetamask,
      walletconnect: connectWalletConnect,
    };
    const connector = (connectors as any)[id]; // eslint-disable-line
    const response = await connector(props.chain);
    emit("response", {
      ...response,
      id,
      connect: connector,
    });
  } catch (error) {
    loading.value = false;

    emit("error", error);
  } finally {
    showModal.value = false;
    loading.value = false;
    emit("endLoading");
  }
};

onMounted(async () => {
  await nextTick();
  if (props.cachedConnector) {
    connectToWallet(props.cachedConnector);
  } else if (window.ethereum && window.ethereum.isMetaMask && isMobile.value) {
    connectToWallet("metamask");
  }
});
</script>

<template>
  <transition name="modal" v-if="showModal">
    <div class="connect-modal-mask" @click.stop="showModal = false">
      <div class="connect-modal-wrapper">
        <div class="connect-modal-container">
          <div class="connect-modal-body">
            <div v-for="connector in availableConns" :key="connector.type">
              <template
                v-if="['metamask', 'metamask-mobile'].includes(connector.type)"
              >
                <div v-if="windowObj.ethereum">
                  <Connector
                    v-if="!connector.mobileOnly"
                    @connect="connectToWallet"
                    :connector="connector"
                  />
                </div>
                <div v-else>
                  <template v-if="isMobile">
                    <a
                      v-if="connector.href && !windowObj.ethereum"
                      :href="connector.href"
                      ><Connector :connector="connector"
                    /></a>
                  </template>
                </div>
              </template>
              <template v-else>
                <Connector @connect="connectToWallet" :connector="connector" />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style lang="css">
.connector {
  padding: 24px 16px;
  cursor: pointer;
  text-align: center;
}

.connector__img img {
  width: 45px;
  height: 45px;
}
.connector:first-child {
  border-bottom: 1px solid rgba(195, 195, 195, 0.5);
}
.connector__name {
  font-size: 24px;
  font-weight: 700;
  margin-top: 0.5rem;
  color: rgb(12, 12, 13);
}
.connector__desc {
  font-size: 16px;
  margin: 0.333em 0px;
  color: rgb(169, 169, 188);
}

@media screen and (max-width: 768px) {
  .connector__name {
    font-size: 5vw;
  }
  .connector__desc {
    font-size: 4vw;
  }
  .connector__img img {
    width: 8.5vw;
    height: 8.5vw;
  }
}

.connect-modal-mask {
  position: fixed;
  z-index: 9998;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: table;
  transition: opacity 0.3s ease;
}

.connect-modal-wrapper {
  display: table-cell;
  vertical-align: middle;
}

.connect-modal-container {
  max-width: 500px;
  max-height: 100%;
  overflow: auto;
  margin: 20px auto;

  transition: all 0.3s ease;
}

.connect-modal-body {
  margin: 20px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.33);
  border-radius: 16px;
}

.connect-modal-body a {
  text-decoration: none;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter {
  opacity: 0;
}

.modal-leave-active {
  opacity: 0;
}

.modal-enter .modal-container,
.modal-leave-active .modal-container {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}
</style>
