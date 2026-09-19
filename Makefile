.PHONY: build-CaseSevaFunction

build-CaseSevaFunction:
	pip install -r backend/requirements.txt -t $(ARTIFACTS_DIR)/
	xcopy /E /I /Q /Y backend $(ARTIFACTS_DIR)\backend
