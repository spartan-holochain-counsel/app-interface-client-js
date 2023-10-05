[![](https://img.shields.io/npm/v/@spartan-hc/app-interface-client/latest?style=flat-square)](http://npmjs.com/package/@spartan-hc/app-interface-client)

# Holochain App Client
A Javascript client for communicating with [Holochain](https://holochain.org)'s App Interface API.

[![](https://img.shields.io/github/issues-raw/spartan-holochain-counsel/app-interface-client-js?style=flat-square)](https://github.com/spartan-holochain-counsel/app-interface-client-js/issues)
[![](https://img.shields.io/github/issues-closed-raw/spartan-holochain-counsel/app-interface-client-js?style=flat-square)](https://github.com/spartan-holochain-counsel/app-interface-client-js/issues?q=is%3Aissue+is%3Aclosed)
[![](https://img.shields.io/github/issues-pr-raw/spartan-holochain-counsel/app-interface-client-js?style=flat-square)](https://github.com/spartan-holochain-counsel/app-interface-client-js/pulls)


## Overview
This client is guided by the interfaces defined in the
[holochain/holochain](https://github.com/holochain/holochain) project.

### Features

- Support for Zomelets


## Install

```bash
npm i @spartan-hc/app-interface-client
```

## Simplest Usage

```js
import { AppInterfaceClient } from '@spartan-hc/app-interface-client';

const client = new AppInterfaceClient( app_port );
const app_client = await client.app( app_id );

await app_client.call( "role_name", "zome_name", "fn_name", args );
```


### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
