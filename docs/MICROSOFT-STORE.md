# Microsoft Store release

This repository builds two Windows distribution formats:

- **MSIX for the Microsoft Store:** the CI package is unsigned. Once it has the exact reserved Partner Center identity, submit the MSIX and Microsoft signs it for Store distribution.
- **MSI/NSIS installers:** release builds sign the app executable and native DLLs before bundling, then sign both installers with Microsoft Artifact Signing. Pull request builds skip signing and are only for CI review.

## One-time Store setup

1. Enroll in the Microsoft Store developer program and reserve **NVRBEATS** in Partner Center.
2. Copy the reserved package identity **Name** and **Publisher** values from Partner Center.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add:
   - `STORE_PACKAGE_NAME`: the reserved package identity Name.
   - `STORE_PUBLISHER`: the exact Publisher distinguished name from Partner Center.
4. Run the **Windows Release Build** workflow again. It will upload a `microsoft-store-msix` artifact when the reserved identity variables are configured.
5. Upload the MSIX in Partner Center, complete the Store listing and required screenshots/privacy details, and submit it for certification.

Do not submit the preview artifact or use an invented identity: the package identity must match the app name reserved in Partner Center. The MSIX is unsigned for Store submission; do not distribute it directly. Microsoft signs an accepted MSIX during Store certification.

## Artifact Signing for MSI/EXE releases

Non-pull-request runs of **Windows Release Build** require the signing setup below. If it is missing, the workflow stops before publishing an unsigned installer release. Pull request builds continue without credentials and upload unsigned test artifacts.

### Azure setup

1. Create an Azure Artifact Signing account and a publicly trusted code-signing certificate profile. Complete any required publisher identity validation.
2. Create an Entra ID app registration for GitHub Actions and a federated credential with:
   - **Issuer:** `https://token.actions.githubusercontent.com`
   - **Subject:** `repo:sar365/NVRBEATS:environment:nvrbeats-signing`
   - **Audience:** `api://AzureADTokenExchange`
3. Assign the app's service principal the **Artifact Signing Certificate Profile Signer** role at the appropriate certificate profile/account scope.
4. In GitHub, open **Settings → Environments** and create an environment named `nvrbeats-signing`.
5. Add these **environment variables** to `nvrbeats-signing`:
   - `ARTIFACT_SIGNING_ENDPOINT`: the endpoint for the region hosting the Artifact Signing account, such as `https://eus.codesigning.azure.net/`.
   - `ARTIFACT_SIGNING_ACCOUNT_NAME`: the Artifact Signing account name.
   - `ARTIFACT_SIGNING_CERTIFICATE_PROFILE`: the public-trust certificate profile name.
6. Add these **environment secrets** to `nvrbeats-signing`:
   - `AZURE_CLIENT_ID`: the Entra app's application (client) ID.
   - `AZURE_TENANT_ID`: the Entra directory (tenant) ID.
   - `AZURE_SUBSCRIPTION_ID`: the Azure subscription containing the signing account.

The workflow uses GitHub OIDC; it does not need a stored Azure client secret. Release builds sign `dj-set-recorder.exe` and native DLLs before Tauri bundles them, then sign the generated MSI and NSIS EXE installers. The Store MSIX is a separate path: it contains the signed app files but is submitted unsigned for Microsoft to sign during certification.

The current release target is x64. In Partner Center, submit the signed, versioned MSI asset from a successful GitHub release and select **x64**. Do not change or replace that release asset after submission; publish a new version for updates. Microsoft requires MSI/EXE Store installers to be signed by a certificate chaining to a trusted root, and the installer must support silent installation.

## Updates

Each Store submission needs a version higher than the version currently published in Partner Center. Update `version` in `src-tauri/Cargo.toml` before creating a Store release. The packaging script converts the three-part Cargo version to the four-part version required by MSIX.

Store enrollment, listing content, account identity verification, certification, and publication must be completed in Partner Center by the publisher.
