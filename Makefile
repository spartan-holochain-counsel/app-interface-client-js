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

npm-use-holo-host-public:
npm-use-holo-host-local:
npm-use-holo-host-%:
	NPM_PACKAGE=@spartan-hc/holo-host LOCAL_PATH=../../holo-host-js make npm-reinstall-$*

npm-use-serialization-public:
npm-use-serialization-local:
npm-use-serialization-%:
	NPM_PACKAGE=@spartan-hc/holochain-serialization LOCAL_PATH=../../holochain-serialization-js make npm-reinstall-$*

npm-use-websocket-public:
npm-use-websocket-local:
npm-use-websocket-%:
	NPM_PACKAGE=@spartan-hc/holochain-websocket LOCAL_PATH=../../holochain-websocket-js make npm-reinstall-$*

npm-use-admin-client-public:
npm-use-admin-client-local:
npm-use-admin-client-%:
	NPM_PACKAGE=@spartan-hc/holochain-admin-client LOCAL_PATH=../../holochain-admin-client-js make npm-reinstall-$*

npm-use-backdrop-public:
npm-use-backdrop-local:
npm-use-backdrop-%:
	NPM_PACKAGE=@spartan-hc/holochain-backdrop LOCAL_PATH=../../node-holochain-backdrop make npm-reinstall-$*

npm-use-zomelets-public:
npm-use-zomelets-local:
npm-use-zomelets-%:
	NPM_PACKAGE=@spartan-hc/zomelets LOCAL_PATH=../../zomelets-js make npm-reinstall-$*


#
# Testing
#
DEBUG_LEVEL	       ?= warn
TEST_ENV_VARS		= LOG_LEVEL=$(DEBUG_LEVEL)
MOCHA_OPTS		= -t 15000 -n enable-source-maps

CONTENT_DNA		= tests/content_dna.dna
TEST_DNAS		= $(CONTENT_DNA)

tests/%.dna:			FORCE
	cd tests; make $*.dna

test:
	make -s test-unit
	make -s test-integration

test-unit:			build
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit

test-integration:		build $(CONTENT_DNA)
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration



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
