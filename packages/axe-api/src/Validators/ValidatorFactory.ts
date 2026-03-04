import { AxeConfig, IValidator } from "../Interfaces";
import Validatorjs from "./Validatorjs";
import RobustValidator from "./RobustValidator";
import { AppLoader } from "src/AppLoader";

class ValidatorFactory {
  static resolve(): IValidator {
    const appLoader = AppLoader.getInstance();
    const config = appLoader.map.config as AxeConfig;

    const supportedLanguages = [
      ...new Set(
        Object.values(appLoader.map.versions)
          .map((version) => version.config.supportedLanguages)
          .flat(),
      ),
    ];

    switch (config.validator) {
      case "validatorjs":
        return new Validatorjs(supportedLanguages);
      case "robust-validator":
        return new RobustValidator(supportedLanguages);
      default:
        throw new Error(`Undefined validator library: ${config.validator}`);
    }
  }
}

export default ValidatorFactory;
