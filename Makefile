.PHONY:			FORCE

#
# Project
#
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
build:			node_modules

npm-reinstall-local:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(LOCAL_PATH)
npm-reinstall-public:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(NPM_PACKAGE)
npm-reinstall-dev-local:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save-dev $(LOCAL_PATH)
npm-reinstall-dev-public:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save-dev $(NPM_PACKAGE)

npm-use-holo-host-public:
npm-use-holo-host-local:
npm-use-holo-host-%:
	NPM_PACKAGE=@spartan-hc/holo-host LOCAL_PATH=../../holo-host-js make npm-reinstall-$*

npm-use-serialization-public:
npm-use-serialization-local:
npm-use-serialization-%:
	NPM_PACKAGE=@spartan-hc/holochain-serialization LOCAL_PATH=../../hc-serialization-js make npm-reinstall-$*

npm-use-websocket-public:
npm-use-websocket-local:
npm-use-websocket-%:
	NPM_PACKAGE=@spartan-hc/holochain-websocket LOCAL_PATH=../../hc-websocket-js make npm-reinstall-$*

npm-use-zomelets-public:
npm-use-zomelets-local:
npm-use-zomelets-%:
	NPM_PACKAGE=@spartan-hc/zomelets LOCAL_PATH=../../zomelets-js make npm-reinstall-$*

npm-use-backdrop-public:
npm-use-backdrop-local:
npm-use-backdrop-%:
	NPM_PACKAGE=@spartan-hc/holochain-backdrop LOCAL_PATH=../../node-backdrop make npm-reinstall-dev-$*


#
# Testing
#
DEBUG_LEVEL	       ?= warn
TEST_ENV_VARS		= LOG_LEVEL=$(DEBUG_LEVEL)
MOCHA_OPTS		= -t 15000 -n enable-source-maps

CONTENT_DNA		= tests/content_dna.dna
TEST_DNAS		= $(CONTENT_DNA)

tests/%.dna:			FORCE
	cd tests; make -s $*.dna

test:
	make -s test-unit
	make -s test-integration

test-unit:
	make -s test-unit-hierarchy
	make -s test-unit-holo-hash-map
	make -s test-unit-proxies

test-unit-hierarchy:		build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_hierarchy.js
test-unit-holo-hash-map:	build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_holo_hash_map.js
test-unit-proxies:		build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_proxies.js

test-integration:
	make -s test-integration-basic

test-integration-basic:		build $(CONTENT_DNA)
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration/test_basic.js



#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx



#
# NPM packaging
#
prepare-package:
	rm -f dist/*
	npx webpack
	MODE=production npx webpack
	gzip -kf dist/*.js
preview-package:	clean-files test prepare-package
	npm pack --dry-run .
create-package:		clean-files test prepare-package
	npm pack .
publish-package:	clean-files test prepare-package
	npm publish --access public .
