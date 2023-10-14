import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-proxies", process.env.LOG_LEVEL );

import crypto				from 'crypto';

import { expect }			from 'chai';

import json				from '@whi/json';
import {
    HoloHash,
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';

import { expect_reject }		from '../utils.js';
import {
    ZomesProxy,
    FunctionsProxy,
}					from '../../src/proxies.js';

class ScopedZomelet {
}

function zomes_proxy_tests () {

    it("should set a zome", async function () {
	const zomes			= new ZomesProxy( {}, "role_name" );

	zomes.zome_name			= new ScopedZomelet();
    });

    describe("ZomesProxy Errors",	zomes_errors_tests );
}

function zomes_errors_tests () {

    it("should fail to set invalid values", async function () {
	const zomes			= new ZomesProxy();

	await expect_reject(async () => {
	    zomes.bad_zome		= true;
	}, "Expected an instance with a constructor named 'ScopedZomelet'" );
    });

    it("should fail to get unknown zome", async function () {
	const zomes			= new ZomesProxy( {}, "ScopedZomelet 'role_name'" );

	await expect_reject(async () => {
	    zomes.unknown_zome
	}, "does not exist in ScopedZomelet" );
    });

}

function funcs_proxy_tests () {

    it("should set a function", async function () {
	const funcs			= new FunctionsProxy();

	funcs.name			= async function () { return null };
    });

    describe("FunctionsProxy Errors",	funcs_errors_tests );
}

function funcs_errors_tests () {

    it("should fail to set invalid values", async function () {
	const funcs			= new FunctionsProxy();

	await expect_reject(async () => {
	    funcs.bad_function		= true;
	}, "Expected a 'function'" );
    });

    it("should fail to get unknown function", async function () {
	const funcs			= new FunctionsProxy( {}, "ScopedZomelet 'zome_name'" );

	await expect_reject(async () => {
	    funcs.unknown_function
	}, "does not have a defined function in ScopedZomelet" );
    });

}

describe("Proxies", () => {

    describe("ZomesProxy",		zomes_proxy_tests );
    describe("FunctionsProxy",		funcs_proxy_tests );

});
