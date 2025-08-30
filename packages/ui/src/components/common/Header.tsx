import BigText from "ink-big-text";
import Gradient from "ink-gradient";

export const Header = ({ title }: { title: string }) => (
  <Gradient name="teen">
    <BigText
      text={title}
      font="block"
    />
  </Gradient>
);
