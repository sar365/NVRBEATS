# Microsoft Store release

The Windows workflow creates an unsigned MSIX package. Until the Partner Center identity is configured, it uses a clearly labeled preview identity and uploads `microsoft-store-msix-preview`; that package is for CI checks only and cannot be submitted. Once configured, it uploads `microsoft-store-msix` using the reserved identity. The Store signs an accepted MSIX for distribution, so this path does not require a Microsoft Artifact Signing account or a certificate in GitHub Actions. The current MSI and EXE remain available as build artifacts for testing; they are not signed for public direct downloads.

## One-time Store setup

1. Enroll in the Microsoft Store developer program and reserve **NVRBEATS** in Partner Center.
2. Copy the reserved package identity **Name** and **Publisher** values from Partner Center.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add:
   - `STORE_PACKAGE_NAME`: the reserved package identity Name.
   - `STORE_PUBLISHER`: the exact Publisher distinguished name, for example `CN=Example Publisher, O=Example Company, C=US`.
4. Run the **Windows Release Build** workflow again. It will upload a submission-ready `microsoft-store-msix` artifact alongside the existing Windows installer artifact.
5. Upload the MSIX in Partner Center, complete the Store listing and required screenshots/privacy details, and submit it for certification.

Do not submit the preview artifact or use an invented identity: the package identity must match the app name reserved in Partner Center. The package is unsigned for Store submission; do not distribute this MSIX directly to users. Microsoft signs it during Store certification.

## Updates

Each submission needs a version higher than the version currently published in Partner Center. Update `version` in `src-tauri/Cargo.toml` before creating a Store release. The packaging script converts the three-part Cargo version to the four-part version required by MSIX.

## Direct downloads

If MSI or EXE downloads are later offered outside the Store, add a separate Microsoft Artifact Signing step for those files and the app executable. Store MSIX signing does not sign these standalone installers. Store enrollment, listing content, account identity verification, certification, and publication must be completed in Partner Center by the publisher.
